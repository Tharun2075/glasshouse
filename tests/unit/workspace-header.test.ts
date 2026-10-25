import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicOptions } from "../../lib/extract.ts";

// No network: a fake fetch records the outgoing request headers and answers like the API.
function capture(env: { ANTHROPIC_WORKSPACE_ID?: string }) {
  const seen: Headers[] = [];
  const fetch = async (_url: any, init: any) => {
    seen.push(new Headers(init.headers));
    return new Response(JSON.stringify({ id: "msg_x", type: "message", role: "assistant", model: "m", content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new Anthropic({ apiKey: "test-key", fetch: fetch as any, ...anthropicOptions(env) });
  return { client, seen };
}
const ask = (c: Anthropic) => c.messages.create({ model: "m", max_tokens: 1, messages: [{ role: "user", content: "hi" }] });

describe("anthropic-workspace-id header", () => {
  it("is sent on every request when ANTHROPIC_WORKSPACE_ID is set", async () => {
    const { client, seen } = capture({ ANTHROPIC_WORKSPACE_ID: "wrkspc_test" });
    await ask(client);
    expect(seen[0].get("anthropic-workspace-id")).toBe("wrkspc_test");
  });
  it("is absent when the env var is blank", async () => {
    const { client, seen } = capture({ ANTHROPIC_WORKSPACE_ID: "" });
    await ask(client);
    expect(seen[0].has("anthropic-workspace-id")).toBe(false);
  });
});
