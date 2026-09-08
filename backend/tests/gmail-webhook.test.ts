import { describe, expect, it, vi } from "vitest";

const { verify, enqueue } = vi.hoisted(() => ({ verify: vi.fn(), enqueue: vi.fn() }));
vi.mock("../src/services/gmail/pubsub-auth.service.js", () => ({
  PubSubAuthenticationError: class PubSubAuthenticationError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  verifyPubSubPushToken: verify,
}));
vi.mock("../src/services/gmail/gmail-notification.service.js", () => ({ enqueueGmailNotification: enqueue }));

import { gmailPubSubWebhook } from "../src/controllers/gmail-webhook.controller.js";

function responseRecorder() {
  const result = { statusCode: 0, body: undefined as unknown };
  return { result, response: { status(code: number) { result.statusCode = code; return this; }, json(body: unknown) { result.body = body; return this; } } };
}

describe("Gmail Pub/Sub webhook", () => {
  it("rejects a missing or invalid authorization token", async () => {
    verify.mockRejectedValueOnce(new Error("invalid"));
    const { result, response } = responseRecorder();
    await gmailPubSubWebhook({ header: () => undefined, body: {} } as never, response as never);
    expect(result.statusCode).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects malformed Pub/Sub data", async () => {
    verify.mockResolvedValueOnce({});
    const { result, response } = responseRecorder();
    await gmailPubSubWebhook({ header: () => "Bearer token", body: { message: { data: "not base64!" } } } as never, response as never);
    expect(result.statusCode).toBe(400);
  });

  it("acknowledges a valid notification and dispatches only its metadata", async () => {
    verify.mockResolvedValueOnce({});
    const data = Buffer.from(JSON.stringify({ emailAddress: "analyst@gmail.com", historyId: "123" })).toString("base64");
    const { result, response } = responseRecorder();
    await gmailPubSubWebhook({ header: () => "Bearer token", body: { message: { data, messageId: "pubsub-1" } } } as never, response as never);
    expect(result.statusCode).toBe(200);
    expect(enqueue).toHaveBeenCalledWith({ emailAddress: "analyst@gmail.com", historyId: "123" });
  });

  it("accepts Gmail's numeric history ID representation", async () => {
    verify.mockResolvedValueOnce({});
    const data = Buffer.from(JSON.stringify({ emailAddress: "analyst@gmail.com", historyId: 123 })).toString("base64");
    const { result, response } = responseRecorder();
    await gmailPubSubWebhook({ header: () => "Bearer token", body: { message: { data } } } as never, response as never);
    expect(result.statusCode).toBe(200);
    expect(enqueue).toHaveBeenCalledWith({ emailAddress: "analyst@gmail.com", historyId: "123" });
  });
});
