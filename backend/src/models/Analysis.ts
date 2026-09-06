import mongoose from "mongoose";
import type { AnalysisResult } from "../types/email.js";

const analysisSchema = new mongoose.Schema<AnalysisResult & { emailId: mongoose.Types.ObjectId }>({
  emailId: { type: mongoose.Schema.Types.ObjectId, ref: "Email", required: true },
  riskScore: { type: Number, required: true },
  verdict: { type: String, required: true },
  confidence: Number,
  findings: { type: mongoose.Schema.Types.Mixed, required: true },
  authentication: { type: mongoose.Schema.Types.Mixed, required: true },
  assessmentNote: String,
  urlIntelligence: { type: mongoose.Schema.Types.Mixed, required: true },
  relayPath: { type: mongoose.Schema.Types.Mixed, required: true },
  probableOriginIp: String,
  enrichment: { type: mongoose.Schema.Types.Mixed, required: true },
  scoreExplanation: { type: mongoose.Schema.Types.Mixed, required: true },
  analystVerdict: { type: mongoose.Schema.Types.Mixed, required: true },
  classification: { type: mongoose.Schema.Types.Mixed, required: true },
  entities: { type: mongoose.Schema.Types.Mixed, required: true },
  ml: { type: mongoose.Schema.Types.Mixed },
  mlAssistance: { type: mongoose.Schema.Types.Mixed },
  payloadAnalysis: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export const AnalysisModel = mongoose.model("Analysis", analysisSchema);