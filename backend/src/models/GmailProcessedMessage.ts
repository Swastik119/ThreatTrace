import mongoose from "mongoose";

const gmailProcessedMessageSchema = new mongoose.Schema({
  gmailAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "GmailAccount", required: true },
  gmailMessageId: { type: String, required: true },
  status: { type: String, enum: ["PROCESSING", "COMPLETED", "FAILED"], required: true },
  processingLeaseUntil: { type: Date, required: true },
  investigationId: { type: mongoose.Schema.Types.ObjectId, ref: "Investigation" },
  lastErrorCategory: String,
}, { timestamps: true });

gmailProcessedMessageSchema.index({ gmailAccountId: 1, gmailMessageId: 1 }, { unique: true });

export const GmailProcessedMessageModel = mongoose.model("GmailProcessedMessage", gmailProcessedMessageSchema);
