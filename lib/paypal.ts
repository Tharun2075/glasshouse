// PayPal REST over fetch. SANDBOX ONLY: the host is a constant and never read from env.
import { fmt } from "./money.ts";
export const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

let tok: { v: string; exp: number } | null = null;

export async function token(): Promise<string> {
  if (tok && tok.exp > Date.now() + 60_000) return tok.v;
  const id = process.env.PAYPAL_CLIENT_ID, sec = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !sec) throw new Error("PayPal sandbox credentials missing (.env.local)");
  const r = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${sec}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`oauth ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tok = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tok.v;
}

async function call(method: string, path: string, body: unknown, requestId?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", Prefer: "return=representation" };
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  const r = await fetch(`${PAYPAL_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { http: r.status, body: j as any, debugId: r.headers.get("paypal-debug-id") };
}

export function orderBody(cents: number, appealTitle: string, returnUrl: string, cancelUrl: string) {
  const v = fmt(cents);
  return {
    intent: "CAPTURE",
    purchase_units: [{
      description: `Donation: ${appealTitle}`.slice(0, 127),
      amount: { currency_code: "USD", value: v, breakdown: { item_total: { currency_code: "USD", value: v } } },
      items: [{ name: `Donation to ${appealTitle}`.slice(0, 127), quantity: "1", unit_amount: { currency_code: "USD", value: v }, category: "DONATION" }],
    }],
    payment_source: { paypal: { experience_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } } },
  };
}

export async function createOrder(cents: number, appealTitle: string, returnUrl: string, cancelUrl: string, requestId: string) {
  const r = await call("POST", "/v2/checkout/orders", orderBody(cents, appealTitle, returnUrl, cancelUrl), requestId);
  const approve = (r.body.links ?? []).find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href as string | undefined;
  return { ...r, id: r.body.id as string | undefined, status: r.body.status as string | undefined, approve };
}

export async function captureOrder(orderId: string, requestId: string) {
  const r = await call("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, requestId);
  const cap = r.body.purchase_units?.[0]?.payments?.captures?.[0];
  return { ...r, status: r.body.status as string | undefined, captureId: cap?.id as string | undefined, captured: cap?.amount as { currency_code: string; value: string } | undefined };
}

export async function getOrder(orderId: string) {
  return call("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`, undefined);
}

export async function createPayout(senderBatchId: string, receiver: string, cents: number, note: string) {
  const body = {
    sender_batch_header: { sender_batch_id: senderBatchId, email_subject: "Glasshouse reimbursement (sandbox)", recipient_type: "EMAIL" },
    items: [{ recipient_type: "EMAIL", receiver, note: note.slice(0, 4000), sender_item_id: senderBatchId, amount: { currency: "USD", value: fmt(cents) } }],
  };
  const r = await call("POST", "/v1/payments/payouts", body, senderBatchId);
  return { ...r, batchId: r.body.batch_header?.payout_batch_id as string | undefined, status: r.body.batch_header?.batch_status as string | undefined };
}

export async function getPayout(batchId: string) {
  const r = await call("GET", `/v1/payments/payouts/${encodeURIComponent(batchId)}`, undefined);
  return { ...r, status: r.body.batch_header?.batch_status as string | undefined, itemStatus: r.body.items?.[0]?.transaction_status as string | undefined };
}
