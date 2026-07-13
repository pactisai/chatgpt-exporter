import { EventEmitter } from "events";
import { scrapeChatGPT } from "../core/scraper.js";

const MAX_CONCURRENT = 2;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const jobs = new Map();
const cache = new Map();
let running = 0;
const emitter = new EventEmitter();

export function enqueue(url) {
  const id = crypto.randomUUID();

  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    jobs.set(id, { id, status: "done", url, result: cached.result, createdAt: Date.now() });
    return id;
  }

  jobs.set(id, {
    id,
    status: "queued",
    url,
    progress: { phase: "queued", message: "Waiting in queue..." },
    createdAt: Date.now(),
  });

  emitter.emit("job:new", id);
  return id;
}

export function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;

  const { status, progress, result, error, url, createdAt } = job;
  return { id, status, progress, result, error, url, createdAt, queueSize: running > 0 ? queueSize() : 0 };
}

export function queueSize() {
  let count = 0;
  for (const [, job] of jobs) {
    if (job.status === "queued") count++;
  }
  return count;
}

function getNextQueued() {
  for (const [, job] of jobs) {
    if (job.status === "queued") return job;
  }
  return null;
}

async function processNext() {
  if (running >= MAX_CONCURRENT) return;

  const job = getNextQueued();
  if (!job) return;

  running++;
  job.status = "processing";
  job.startedAt = Date.now();

  try {
    const result = await scrapeChatGPT(job.url, (p) => {
      job.progress = p;
    });

    job.status = "done";
    job.result = result;
    job.completedAt = Date.now();

    cache.set(job.url, { timestamp: Date.now(), result });
  } catch (e) {
    job.status = "error";
    job.error = e.message;
    job.completedAt = Date.now();
  } finally {
    running--;
    emitter.emit("job:done", job.id);
    processNext();
  }
}

emitter.on("job:new", () => {
  while (running < MAX_CONCURRENT) {
    const next = getNextQueued();
    if (!next) break;
    processNext();
  }
});
