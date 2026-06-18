// Helper for the site-wide passcode gate.
//
// We never store the cleartext passcode in a cookie - the cookie carries a
// SHA-256 hash of it instead. Middleware computes the same hash from the env
// var and compares; the cleartext only lives in env config. Edge and Node
// runtimes both expose crypto.subtle, so the same helper works in middleware
// (Edge) and in the gate page's server action (Node).

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const GATE_COOKIE = "lh_gate";
export const GATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
