import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { startGmailWatchRenewalScheduler } from "./services/gmail/gmail-watch.service.js";

const app = createApp();
connectDatabase().then(() => {
  startGmailWatchRenewalScheduler();
  app.listen(env.PORT, () => console.log(`ThreatTrace API listening on http://localhost:${env.PORT}`));
}).catch((error: unknown) => {
  console.error("Unable to connect to MongoDB.", error);
  process.exitCode = 1;
});
