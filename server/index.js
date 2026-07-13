import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { scrapeChatGPT } from "../core/scraper.js";
import { enqueue, getJob } from "./queue.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Queue-based scrape (recommended) ──
app.post("/api/jobs", (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("chatgpt.com/share/")) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }

  const jobId = enqueue(url.trim());
  res.json({ jobId, status: "queued" });
});

app.get("/api/jobs/:jobId", (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// ── Legacy SSE scrape (kept for backward compat) ──
app.post("/api/scrape", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("chatgpt.com/share/")) {
    return res.status(400).json({ error: "Valid ChatGPT share URL required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const result = await scrapeChatGPT(url, send);
    send({ type: "done", ...result });
  } catch (e) {
    console.error("Scrape error:", e.message);
    send({ type: "error", error: e.message });
  } finally {
    res.end();
  }
});

app.use(express.static(path.join(__dirname, "..", "dist")));

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`ChatGPT Exporter by Pactis → http://localhost:${PORT}`);
});
