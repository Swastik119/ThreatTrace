import mongoose from "mongoose";
import type { NormalizedEmail } from "../types/email.js";

const emailSchema = new mongoose.Schema<NormalizedEmail & { userId?: string; gmailMessageId?: string; outlookMessageId?: string; cloudinary?: { publicId: string; secureUrl: string; resourceType: string }; createdAt?: Date; updatedAt?: Date }>({
  userId: String,
  gmailMessageId: String,
  outlookMessageId: String,
  cloudinary: { publicId: String, secureUrl: String, resourceType: String },
  messageId: String,
  sender: { name: String, email: { type: String, required: true } },
  recipients: [{ name: String, email: String }],
  cc: [{ name: String, email: String }],
  subject: { type: String, required: true },
  date: Date,
  headers: { type: mongoose.Schema.Types.Mixed, required: true },
  text: String,
  html: String,
  urls: [String],
  attachments: [{ filename: String, contentType: String, size: Number, sha256: String }],
  replyTo: String,
  returnPath: String,
  source: { type: String, enum: ["EML", "GMAIL", "OUTLOOK"], required: true },
  forwarded: Boolean,
  forwardedHeaders: { type: mongoose.Schema.Types.Mixed },
  receivedHeaders: [String],
}, { timestamps: true });

export const EmailModel = mongoose.model("Email", emailSchema);
