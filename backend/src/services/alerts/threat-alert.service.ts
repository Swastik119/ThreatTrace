import { env } from "../../config/env.js";
import { AlertModel } from "../../models/Alert.js";

/**
 * The application does not yet have a push transport. Alert persistence is
 * therefore the integration seam for the dashboard's existing polling and a
 * future realtime emitter; it deliberately does not introduce another one.
 */
export async function createThreatAlertIfNeeded(input: { userId: string; investigationId: string; riskScore: number; source: "GMAIL" }) {
  if (input.riskScore < env.THREAT_ALERT_THRESHOLD) return undefined;
  const alert = await AlertModel.findOneAndUpdate(
    { investigationId: input.investigationId },
    { $setOnInsert: { ...input, status: "OPEN" } },
    { upsert: true, returnDocument: "after" },
  );
  console.info(JSON.stringify({ event: "THREAT_ALERT_CREATED", investigationId: input.investigationId, riskScore: input.riskScore, source: input.source }));
  return alert;
}
