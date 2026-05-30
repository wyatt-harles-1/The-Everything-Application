// Per-module specialist sub-agents (Phase 4e7 - the final piece of the AI
// vision). The master assistant in /api/assistant/chat can DELEGATE a
// domain question to one of these by calling a `consult_<domain>` tool.
//
// How it works (the "agents-as-tools" pattern):
//  - Each consult_* tool's execute runs a SEPARATE, nested generateText
//    loop: its own coach-voice system prompt + only that domain's read
//    tools. Because it's a fully independent call, its internal tool
//    chatter never leaks into the outer chat stream - the user sees one
//    clean "Consulting X coach…" part with the final finding.
//  - Specialists are READ-ONLY on the database. They cannot mutate
//    anything; the only mutation surface stays on the master, behind the
//    existing approve/reject gate. To recommend a change, a specialist
//    calls `propose_action`, which only VALIDATES + records the proposal.
//    The consult tool returns those proposals to the master, which then
//    relays each through the real mutation tools for the user to approve.
//    This keeps the human-in-the-loop contract structurally intact.

import "server-only";

import { generateText, stepCountIs, tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { COACH_SYSTEM, type CoachDomain } from "./coach";
import { buildDomainReadTools } from "./tools";
import { mutationSchemas, type MutationName } from "./mutationSchemas";

// The specialists map 1:1 to the existing coach domains, so they reuse the
// coach voices verbatim.
export type SpecialistDomain = CoachDomain;

// A change a specialist recommends. `input` has already been validated
// against mutationSchemas[action], so the master can relay it as-is.
export type ProposedAction = {
  action: MutationName;
  input: unknown;
  rationale: string;
};

type SpecialistConfig = {
  domain: SpecialistDomain;
  toolName: `consult_${SpecialistDomain}`;
  label: string;
  consultDescription: string;
  // Which mutations this specialist is allowed to PROPOSE (never execute).
  allowedActions: MutationName[];
};

const SPECIALISTS: SpecialistConfig[] = [
  {
    domain: "lifting",
    toolName: "consult_lifting",
    label: "lifting coach",
    consultDescription:
      "Delegate a lifting question to the user's lifting-coach sub-agent. It reads the active mesocycle, recent sessions, PRs, and lifting rules, and can propose lifting-rule changes, a scheduled session, or a lifting goal. Returns a concise expert finding plus any proposals. Use for analytical / multi-fact lifting questions; for a single fact (e.g. one PR) use the direct read tools instead. Pass a self-contained question.",
    allowedActions: ["update_lifting_rules", "schedule_event", "create_goal"],
  },
  {
    domain: "running",
    toolName: "consult_running",
    label: "running coach",
    consultDescription:
      "Delegate a running question to the user's running-coach sub-agent. It reads recent runs (mileage/pace/HR) and running rules, and can propose running-rule changes, a scheduled run, or a running goal. Returns a concise finding plus any proposals. Use for analytical running questions, not single-fact lookups. Pass a self-contained question.",
    allowedActions: ["update_running_rules", "schedule_event", "create_goal"],
  },
  {
    domain: "health",
    toolName: "consult_health",
    label: "health coach",
    consultDescription:
      "Delegate a recovery/health question to the user's health-coach sub-agent. It reads recent sleep and mood, and can propose a new habit or a health goal. Returns a concise finding plus any proposals. Use for analytical questions about sleep, mood, recovery, or consistency. Pass a self-contained question.",
    allowedActions: ["create_habit", "create_goal"],
  },
  {
    domain: "goals",
    toolName: "consult_goals",
    label: "goals coach",
    consultDescription:
      "Delegate a goals/habits question to the user's goals-coach sub-agent. It reads active goals and habit progress, and can propose a new goal, a goal-status change, or a new habit. Returns a concise finding plus any proposals. Use for questions about goal prioritization, what's at risk, or habit consistency. Pass a self-contained question.",
    allowedActions: ["create_goal", "update_goal_status", "create_habit"],
  },
];

// Appended to each coach voice to reframe it from "write one cached daily
// tip" to "answer the master's specific sub-question, and propose (never
// perform) any change."
const SPECIALIST_SUFFIX = `

You are operating as a specialist sub-agent consulted by the user's master assistant - you are NOT chatting with the user directly. Use your read tools to investigate, then answer the master's question with a tight, specific finding that quotes concrete numbers. You are READ-ONLY: you cannot change any data. If you want to recommend a concrete change (e.g. adjust a rule, schedule something, create/flip a goal or habit), call propose_action with a payload that matches that action's schema; the master will surface it to the user for approval. Never claim you performed a change - you only propose. Skip pleasantries; the master will synthesize your finding for the user.`;

// Build the validate-and-collect propose_action tool for one consult call.
// It does NOT mutate - it checks the action is allowed, validates the
// payload against the shared mutation schema, and pushes it onto the
// closure's `proposals` array for the consult tool to return.
function buildProposeActionTool(
  allowedActions: MutationName[],
  proposals: ProposedAction[],
) {
  return tool({
    description:
      "Recommend a concrete change for the user to approve. This does NOT execute - it records a proposal that the master agent will surface for approval. Only call it for an actual recommended action, and make the payload match the action's schema.",
    inputSchema: z.object({
      action: z
        .string()
        .describe(`The change to propose. One of: ${allowedActions.join(", ")}`),
      input: z
        .record(z.string(), z.unknown())
        .describe("Payload object matching the chosen action's schema."),
      rationale: z
        .string()
        .describe("One sentence: why you recommend this, with concrete numbers."),
    }),
    execute: async ({ action, input, rationale }) => {
      if (!allowedActions.includes(action as MutationName)) {
        return {
          accepted: false,
          error: `"${action}" is not allowed for this specialist. Allowed: ${allowedActions.join(", ")}.`,
        };
      }
      const schema = mutationSchemas[action as MutationName];
      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        return {
          accepted: false,
          error: "Payload did not match the action's schema; fix and retry.",
          issues: parsed.error.issues.map((i) => i.message),
        };
      }
      proposals.push({
        action: action as MutationName,
        input: parsed.data,
        rationale,
      });
      return {
        accepted: true,
        note: "Proposal recorded. The master agent will present it to the user for approval.",
      };
    },
  });
}

// Build one consult_<domain> tool for the master. Its execute spins up the
// nested specialist agent and returns { finding, proposals }.
function buildConsultTool(
  config: SpecialistConfig,
  supabase: SupabaseClient,
  specialistModel: LanguageModel,
  memoryBlock: string,
) {
  return tool({
    description: config.consultDescription,
    inputSchema: z.object({
      question: z
        .string()
        .min(1)
        .describe(
          "A self-contained sub-question INCLUDING all context the specialist needs - it cannot see the chat history or the user's original wording.",
        ),
    }),
    execute: async ({ question }) => {
      // Fresh collector per consult so concurrent specialists don't mix.
      const proposals: ProposedAction[] = [];
      const readTools = buildDomainReadTools(supabase, config.domain);
      const proposeAction = buildProposeActionTool(
        config.allowedActions,
        proposals,
      );
      try {
        const { text } = await generateText({
          model: specialistModel,
          system: COACH_SYSTEM[config.domain] + SPECIALIST_SUFFIX + memoryBlock,
          prompt: question,
          tools: { ...readTools, propose_action: proposeAction },
          // Specialists should converge fast: a couple of reads, maybe a
          // proposal. This budget is independent of the master's outer loop.
          stopWhen: stepCountIs(5),
        });
        return { finding: text.trim(), proposals };
      } catch (e) {
        // A specialist failure (bad key, rate limit, model error) must not
        // sink the whole turn - return it so the master can degrade.
        return {
          error: e instanceof Error ? e.message : "Specialist unavailable.",
          proposals,
        };
      }
    },
  });
}

// The master's specialist tool surface: one consult_* tool per domain.
// `specialistModel` is the user's resolved model today; the param exists so
// a cheaper fast model can drop in later without restructuring.
export function buildSpecialistTools(
  supabase: SupabaseClient,
  specialistModel: LanguageModel,
  memoryBlock: string,
) {
  return Object.fromEntries(
    SPECIALISTS.map((config) => [
      config.toolName,
      buildConsultTool(config, supabase, specialistModel, memoryBlock),
    ]),
  );
}

// Exported for the chat UI so it can show friendly "Consulting X…" labels
// without re-deriving them from tool names.
export const SPECIALIST_LABELS: Record<string, string> = Object.fromEntries(
  SPECIALISTS.map((s) => [s.toolName, s.label]),
);
