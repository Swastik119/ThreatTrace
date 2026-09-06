import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  EXTENSION_ORIGIN: z.string().regex(/^chrome-extension:\/\/[a-p]{32}$/).optional(),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/threattrace"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),
  GMAIL_CALLBACK_URL: z.string().url().default("http://localhost:4000/api/v1/gmail/callback"),
  SESSION_SECRET: z.string().min(32),
  GMAIL_TOKEN_ENCRYPTION_KEY: z.string().min(32).default(process.env.SESSION_SECRET ?? ""),
  VIRUSTOTAL_API_KEY: z.string().optional(),
  URLSCAN_API_KEY: z.string().optional(),
  ABUSEIPDB_API_KEY: z.string().optional(),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().positive().optional(),
  ML_SERVICE_URL: z.string().url().default("http://127.0.0.1:8001"),
  ML_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_TENANT_ID: z.string().min(1).default("common"),
  OUTLOOK_CALLBACK_URL: z.string().url().default("http://localhost:4000/api/v1/outlook/callback"),
  MICROSOFT_AUTH_CALLBACK_URL: z.string().url().default("http://localhost:4000/api/v1/auth/microsoft/callback"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
});

export const env = envSchema.parse(process.env);
