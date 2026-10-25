import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { origin } from "../../lib/http.ts";

const KEYS = ["APP_ORIGIN", "RENDER_EXTERNAL_URL", "PAYPAL_ENV"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });
const req = (h: Record<string, string> = {}) => new Request("http://localhost:3000/login", { headers: h });

describe("origin()", () => {
  it("APP_ORIGIN wins and loses a trailing slash", () => {
    process.env.APP_ORIGIN = "https://app.example/";
    process.env.RENDER_EXTERNAL_URL = "https://render.example";
    expect(origin(req({ "x-forwarded-host": "proxy.example" }))).toBe("https://app.example");
  });
  it("RENDER_EXTERNAL_URL is next", () => {
    process.env.RENDER_EXTERNAL_URL = "https://render.example/";
    expect(origin(req({ "x-forwarded-host": "proxy.example" }))).toBe("https://render.example");
  });
  it("x-forwarded-proto + host", () => {
    expect(origin(req({ "x-forwarded-proto": "https", "x-forwarded-host": "proxy.example, other" }))).toBe("https://proxy.example");
  });
  it("forwarded host without proto uses the request protocol", () => {
    expect(origin(req({ "x-forwarded-host": "proxy.example" }))).toBe("http://proxy.example");
  });
  it("host header when no forwarded host", () => {
    expect(origin(req({ host: "box.example:8080" }))).toBe("http://box.example:8080");
  });
  it("falls back to req.url origin when no headers", () => {
    const r = new Request("http://localhost:3000/login");
    r.headers.delete("host");
    expect(origin(r)).toBe("http://localhost:3000");
  });
  it("live without APP_ORIGIN or Render URL throws", () => {
    process.env.PAYPAL_ENV = "live";
    expect(() => origin(req())).toThrow(/APP_ORIGIN/);
  });
});
