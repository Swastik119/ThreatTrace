import { OAuth2Client } from "google-auth-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PubSubAuthenticationError, verifyPubSubPushToken } from "../src/services/gmail/pubsub-auth.service.js";

const validPayload = { iss: "https://accounts.google.com", email: "threattrace-pubsub-push@email-threat-detection-506414.iam.gserviceaccount.com", email_verified: true };

afterEach(() => vi.restoreAllMocks());

describe("Pub/Sub OIDC verification", () => {
  it("rejects a missing bearer token", async () => {
    await expect(verifyPubSubPushToken()).rejects.toMatchObject<Partial<PubSubAuthenticationError>>({ status: 401 });
  });

  it("accepts only a Google-issued token for the configured service account", async () => {
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue({ getPayload: () => validPayload } as never);
    await expect(verifyPubSubPushToken("Bearer signed-token")).resolves.toEqual(validPayload);
  });

  it("rejects an unexpected issuer or service account", async () => {
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue({ getPayload: () => ({ ...validPayload, iss: "https://issuer.example" }) } as never);
    await expect(verifyPubSubPushToken("Bearer signed-token")).rejects.toMatchObject<Partial<PubSubAuthenticationError>>({ status: 401 });
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue({ getPayload: () => ({ ...validPayload, email: "other@example.iam.gserviceaccount.com" }) } as never);
    await expect(verifyPubSubPushToken("Bearer signed-token")).rejects.toMatchObject<Partial<PubSubAuthenticationError>>({ status: 403 });
  });

  it("rejects invalid, expired, or wrong-audience tokens reported by Google verification", async () => {
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockRejectedValue(new Error("Token used too late"));
    await expect(verifyPubSubPushToken("Bearer invalid-token")).rejects.toMatchObject<Partial<PubSubAuthenticationError>>({ status: 401 });
  });
});
