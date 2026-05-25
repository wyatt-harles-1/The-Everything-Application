// Mutation tool DEFINITIONS for the assistant. No `execute` function -
// these tools are "client-executed" per the AI SDK human-in-the-loop
// pattern. When the model calls one, the AI SDK emits it as a tool
// part in "input-available" state, the chat UI renders an approve
// button, and on approval the client POSTs to /api/assistant/run-tool
// before submitting the result back via addToolResult().

import { tool } from "ai";

import {
  scheduleEventInput,
  markEventDoneInput,
  markEventSkippedInput,
  createHabitInput,
  createGoalInput,
  updateGoalStatusInput,
} from "./mutationSchemas";

export const mutationTools = {
  schedule_event: tool({
    description:
      "Add a planned event to the user's schedule. Requires the user's approval in the chat UI before it's committed.",
    inputSchema: scheduleEventInput,
  }),

  mark_event_done: tool({
    description:
      "Mark a planned scheduled_event as done. Emits a shared.events timeline row. Requires approval. Pass the scheduled_event UUID from a previous query_events call.",
    inputSchema: markEventDoneInput,
  }),

  mark_event_skipped: tool({
    description:
      "Mark a planned scheduled_event as skipped (no timeline event emitted). Requires approval. Pass the scheduled_event UUID.",
    inputSchema: markEventSkippedInput,
  }),

  create_habit: tool({
    description:
      "Create a new recurring habit (e.g. 'meditate daily' = 7x/week, 'lift 3x/week'). Requires approval. Streak tracking starts at started_at; default is today.",
    inputSchema: createHabitInput,
  }),

  create_goal: tool({
    description:
      "Create a new goal in shared.goals. Targets are all optional - many user goals are qualitative. Requires approval.",
    inputSchema: createGoalInput,
  }),

  update_goal_status: tool({
    description:
      "Flip a goal's status: active / paused / achieved / abandoned. Requires approval. Pass the goal UUID from query_goals.",
    inputSchema: updateGoalStatusInput,
  }),
};
