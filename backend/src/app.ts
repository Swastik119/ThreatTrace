import cors from "cors";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import MongoStore from "connect-mongo";

import { env } from "./config/env.js";
import { emailRouter } from "./routes/email.routes.js";
import { investigationRouter } from "./routes/investigation.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { gmailRouter } from "./routes/gmail.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { outlookRouter } from "./routes/outlook.routes.js";
import { copilotRouter } from "./routes/copilot.routes.js";

export function createApp() {
  const app = express();

  // Render runs the app behind a proxy.
  // This allows Express to correctly handle secure cookies over HTTPS.
  app.set("trust proxy", 1);

  app.use(helmet());

  // Allow the deployed frontend to make credentialed requests
  // to this backend.
  const allowedOrigins = [env.FRONTEND_ORIGIN, env.EXTENSION_ORIGIN].filter((origin): origin is string => Boolean(origin));
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  // Store sessions in MongoDB.
  app.use(
    session({
      secret: env.SESSION_SECRET,

      store: MongoStore.create({
        mongoUrl: env.MONGODB_URI,
        collectionName: "sessions",
      }),

      resave: false,
      saveUninitialized: false,

      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.use(express.json());

  app.get("/health", (_request, response) =>
    response.json({ status: "ok" })
  );

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/gmail", gmailRouter);
  app.use("/api/v1/outlook", outlookRouter);
  app.use("/api/v1/emails", emailRouter);
  app.use("/api/v1/investigations", investigationRouter);
  app.use("/api/v1/copilot", copilotRouter);

  app.use(errorHandler);

  return app;
}
