// Runs once when the server starts: refuse to boot without a strong session secret (D8).
export async function register() {
  const { assertSessionSecret } = await import("./lib/auth.ts");
  assertSessionSecret();
}
