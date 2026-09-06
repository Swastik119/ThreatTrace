import { env } from "../../config/env.js";
import type { AnalysisResult, MlAssistance, NormalizedEmail, ThreatVerdict } from "../../types/email.js";

interface MlPredictionResponse {
  prediction: "phishing" | "legitimate";
  confidence: number;
  model: string;
}

function scoreToVerdict(score: number, forwarded: boolean): ThreatVerdict {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  if (score > 0) return "LOW";
  return forwarded ? "INCONCLUSIVE" : "SAFE";
}

export async function inferMlAssistance(email: NormalizedEmail, analysis: AnalysisResult): Promise<MlAssistance> {
  const start = Date.now();
  try {
    const response = await fetch(`${env.ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
      subject: email.subject,
      body: email.text ?? email.html ?? "",
      }),
      signal: AbortSignal.timeout(env.ML_SERVICE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`ML service returned ${response.status}`);
    const result = await response.json() as MlPredictionResponse;
    const phishingProbability = result.prediction === "phishing" ? result.confidence : 1 - result.confidence;
    const mlContribution = Math.round(Math.max(0, Math.min(20, phishingProbability * 20)));
    const deterministicRiskScore = analysis.riskScore;
    const fusedScore = Math.min(100, deterministicRiskScore + mlContribution);

    analysis.ml = {
      prediction: result.prediction,
      confidence: result.confidence,
      phishingProbability: Number(phishingProbability.toFixed(4)),
      model: result.model,
    };
    analysis.mlAssistance = {
      available: true,
      modelVersion: result.model,
      mlRiskScore: Math.round(phishingProbability * 100),
      mlConfidence: result.confidence,
      uncertainty: 1 - result.confidence,
      effectiveWeight: 0.2,
      deterministicRiskScore,
      deterministicConfidence: analysis.confidence,
      latencyMs: Date.now() - start,
    };
    analysis.riskScore = fusedScore;
    analysis.confidence = Math.max(analysis.confidence, result.confidence * 0.2);
    analysis.verdict = scoreToVerdict(fusedScore, Boolean(email.forwarded));
    analysis.scoreExplanation.push({
      label: `BERT phishing signal (${result.model})`,
      contribution: mlContribution,
      status: mlContribution > 0 ? "NEGATIVE" : "NEUTRAL",
      evidence: `${result.prediction} @ ${(result.confidence * 100).toFixed(1)}% confidence; capped at 20 points`,
    });
    return analysis.mlAssistance;
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "ML inference unavailable",
      deterministicRiskScore: analysis.riskScore,
      deterministicConfidence: analysis.confidence,
      latencyMs: Date.now() - start,
    };
  }
}