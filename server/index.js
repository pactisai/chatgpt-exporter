import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { load } from "cheerio";
import { createHttpTerminator } from "http-terminator";
import { fileURLToPath } from "url";
import { scrapeChatGPT } from "../core/scraper.js";
import { enqueue, getJob } from "./queue.js";
import { warmPool, closePool } from "../core/pool.js";
import { getOgImage } from "./og-image.js";
import { isValidShareUrl } from "../core/validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DIST_DIR = path.join(__dirname, "..", "dist");

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] }));
app.use(express.json({ type: "application/json", limit: "10kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});
app.use("/api", apiLimiter);

app.get("/api/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

app.get("/og-image.png", async (_req, res) => {
  try {
    const png = await getOgImage();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch { res.status(500).end(); }
});

app.post("/api/jobs", (req, res) => {
  const { url } = req.body;
  if (!isValidShareUrl(url)) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  const jobId = enqueue(url.trim());
  if (!jobId) {
    return res.status(503).json({ error: "Server busy. Try again later." });
  }
  res.json({ jobId, status: "queued" });
});

app.get("/api/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;
  if (!isValidShareUrl(url)) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  try {
    const r = await scrapeChatGPT(url, send);
    send({ type: "done", ...r });
  } catch (e) {
    send({ type: "error", error: e.message });
  } finally {
    res.end();
  }
});

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
