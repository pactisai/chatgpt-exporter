import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { load } from "cheerio";
import { createHttpTerminator } from "http-terminator";
import { fileURLToPath } from "url";
import { warmPool, closePool } from "../core/pool.js";

import healthRouter from "./routes/health.js";
import statsRouter from "./routes/stats.js";
import jobsRouter from "./routes/jobs.js";
import scrapeRouter from "./routes/scrape.js";
import ogImageRouter from "./routes/og-image.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = path.join(__dirname, "..", "dist");

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    ...(process.env.NODE_ENV !== "production" && { maxAge: 0 }),
  },
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] }));
app.use(express.json({ type: "application/json", limit: "10kb" }));

// Trust first proxy for correct client IP behind Railway/nginx
app.set("trust proxy", 1);

// Additional input validation
app.use((req, _res, next) => {
  if (req.body?.url && req.body.url.length > 2048) {
    return _res.status(400).json({ error: "URL too long" });
  }
  next();
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});
app.use("/api", apiLimiter);

// API routes (SOLID — separated by responsibility)
app.use("/api", healthRouter);
app.use("/api", statsRouter);
app.use("/api", jobsRouter);
app.use("/api", scrapeRouter);

// OG image route (top-level, not under /api)
app.use(ogImageRouter);

app.get("/", (req, res) => {
  const indexPath = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexPath)) return res.status(404).send("Not Found");
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const img = `${baseUrl}/og-image.png`;

  const $ = load(fs.readFileSync(indexPath, "utf8"));
  $("head").append(`<meta property="og:title" content="ChatGPT Exporter by Pactis" />`);
  $("head").append(`<meta property="og:description" content="Paste any ChatGPT share link — get the full conversation as Markdown, JSON, or plain text." />`);
  $("head").append(`<meta property="og:type" content="website" />`);
  $("head").append(`<meta property="og:url" content="${baseUrl}" />`);
  $("head").append(`<meta property="og:image" content="${img}" />`);
  $("head").append(`<meta property="og:image:width" content="1200" />`);
  $("head").append(`<meta property="og:image:height" content="630" />`);
  $("head").append(`<meta name="twitter:card" content="summary_large_image" />`);
  $("head").append(`<meta name="twitter:image" content="${img}" />`);

  res.send($.html());
});

app.use(express.static(DIST_DIR));

app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err.message);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, async () => {
  console.log(`ChatGPT Exporter → :${PORT}`);
  await warmPool();
});

const httpTerminator = createHttpTerminator({ server });

async function shutdown(signal) {
  console.log(`[server] ${signal}, shutting down gracefully...`);
  await httpTerminator.terminate();
  await closePool();
  console.log("[server] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled rejection:", reason);
});
