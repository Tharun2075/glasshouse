// Runs once when the server starts: refuse to boot without a strong session secret (D8),
// and in production refuse to boot without a trusted proxy, so rate limits key per client, not one shared bucket (D9).
export async function register() {
  const { assertSessionSecret } = await import("./lib/auth.ts");
  assertSessionSecret();
  if (process.env.NODE_ENV === "production" && process.env.TRUST_PROXY !== "1" && process.env.ALLOW_SHARED_RATE_LIMIT !== "1")
    throw new Error("production needs TRUST_PROXY=1 behind a proxy that appends the client IP (or ALLOW_SHARED_RATE_LIMIT=1 for a single-user demo)");
}
