import mongoose from "mongoose";
import { env } from "./env.js";
import { UserModel } from "../models/User.js";
import { GmailAccountModel } from "../models/GmailAccount.js";
import { GmailProcessedMessageModel } from "../models/GmailProcessedMessage.js";
import { AlertModel } from "../models/Alert.js";

async function migrateLegacyUsers(): Promise<void> {
  const users = await UserModel.find({ $or: [{ username: { $exists: false } }, { username: null }, { username: "" }] }).select("_id email").lean();
  const existingUsers = await UserModel.find({ username: { $exists: true, $nin: [null, ""] } }).select("username").lean();
  const usedUsernames = new Set(existingUsers.map((user) => user.username));

  for (const user of users) {
    const base = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "analyst";
    let username = base;
    let suffix = 1;
    while (usedUsernames.has(username)) username = `${base}${suffix++}`.slice(0, 24);
    usedUsernames.add(username);
    await UserModel.updateOne({ _id: user._id }, { $set: { username } });
  }
}

async function migrateOptionalProviderIndexes(): Promise<void> {
  const indexes = await UserModel.collection.listIndexes().toArray();
  const expectedIndexes = new Map([
    ["email_1", { key: { email: 1 }, unique: true, sparse: false }],
    ["username_1", { key: { username: 1 }, unique: true, sparse: false }],
    ["googleId_1", { key: { googleId: 1 }, unique: true, sparse: true }],
    ["microsoftId_1", { key: { microsoftId: 1 }, unique: true, sparse: true }],
  ]);
  for (const index of indexes) {
    const expected = index.name ? expectedIndexes.get(index.name) : undefined;
    if (!expected) continue;
    const matches = JSON.stringify(index.key) === JSON.stringify(expected.key)
      && Boolean(index.unique) === expected.unique
      && Boolean(index.sparse) === expected.sparse;
    if (!matches) await UserModel.collection.dropIndex(index.name!);
  }
  await UserModel.createIndexes();
}

/** Safe, additive migration for existing Gmail connections and new indexes. */
async function migrateGmailRealtimeAnalysis(): Promise<void> {
  await GmailAccountModel.updateMany({ autoAnalysisEnabled: { $exists: false } }, { $set: { autoAnalysisEnabled: false } });
  await Promise.all([
    GmailAccountModel.createIndexes(),
    GmailProcessedMessageModel.createIndexes(),
    AlertModel.createIndexes(),
  ]);
}

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  await migrateLegacyUsers();
  await migrateOptionalProviderIndexes();
  await migrateGmailRealtimeAnalysis();
}
