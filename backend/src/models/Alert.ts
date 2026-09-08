import mongoose from "mongoose";

const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  investigationId: { type: mongoose.Schema.Types.ObjectId, ref: "Investigation", required: true, unique: true },
  riskScore: { type: Number, required: true },
  source: { type: String, enum: ["GMAIL"], required: true },
  status: { type: String, enum: ["OPEN"], default: "OPEN" },
}, { timestamps: true });

export const AlertModel = mongoose.model("Alert", alertSchema);
