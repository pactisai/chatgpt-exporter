import { scrapeChatGPT } from "../core/scraper.js";

const MAX_CONCURRENT = 2;
const MAX_JOBS = 1000;
const MAX_CACHE = 100;
const CACHE_TTL = 60 * 60 * 1000;
const JOB_TTL = 30 * 60 * 1000;

const jobs = new Map();
const cache = new Map();
let running = 0;

export function enqueue(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const id = crypto.randomUUID();
    jobs.set(id, { id, status: "done", url, result: cached.result, createdAt: Date.now() });
    return id;
  }

  cleanOld(jobs, JOB_TTL);
  if (jobs.size >= MAX_JOBS) return null;

  const id = crypto.randomUUID();
  jobs.set(id, {
    id,
    status: "queued",
    url,
    progress: { phase: "queued", message: "Waiting..." },
    createdAt: Date.now(),
  });

  processNext();
  return id;
}

export function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  const { status, progress, result, error, url, createdAt } = job;
  return { id, status, progress, result, error, url, createdAt };
}

function dequeueNext() {
  for (const [, job] of jobs) {
    if (job.status === "queued") {
      job.status = "processing";
      return job;
    }
  }
  return null;
}

async function processNext() {
  if (running >= MAX_CONCURRENT) return;

  let job = dequeueNext();
  if (!job) return;

  running++;
  job.startedAt = Date.now();

  try {
    const result = await scrapeChatGPT(job.url, (p) => {
      job.progress = p;
    });

    job.status = "done";
    job.result = result;
    job.completedAt = Date.now();

    cleanOld(cache, MAX_CACHE * 2);
    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
    cache.set(job.url, { timestamp: Date.now(), result });
  } catch (e) {
    job.status = "error";
    job.error = e.message;
    job.completedAt = Date.now();
    console.error("[queue] Job failed:", e.message);
  } finally {
    running--;
    processNext();
  }
}

function cleanOld(map, maxAge) {
  const now = Date.now();
  for (const [key, entry] of map) {
    if (now - (entry.createdAt || entry.timestamp || 0) > maxAge) {
      map.delete(key);
    }
  }
}

setInterval(() => {
  cleanOld(jobs, JOB_TTL);
  cleanOld(cache, CACHE_TTL);
}, 5 * 60 * 1000);
