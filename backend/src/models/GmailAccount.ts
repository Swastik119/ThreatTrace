import mongoose from "mongoose";

const gmailAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  googleAccountId: { type: String, required: true },
  email: { type: String, required: true },
  refreshToken: { type: String, required: true },
  scopes: [String],
  // These fields are deliberately kept on the existing connection record: a
  // Gmail watch is a property of one OAuth connection, not a second account.
  autoAnalysisEnabled: { type: Boolean, default: false },
  gmailWatchHistoryId: { type: String, default: null },
  gmailWatchExpiration: { type: Date, default: null },
  gmailProcessingLeaseUntil: { type: Date, default: null },
  gmailWatchRenewalLeaseUntil: { type: Date, default: null },
  gmailAuthErrorAt: { type: Date, default: null },
}, { timestamps: true });

gmailAccountSchema.index({ email: 1 });

export const GmailAccountModel = mongoose.model("GmailAccount", gmailAccountSchema);
