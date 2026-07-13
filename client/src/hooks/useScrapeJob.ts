import { useState, useCallback, useRef } from "react";
import type { ScrapeResult, JobStatus, Status } from "../types";

export function useScrapeJob() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const handleScrape = useCallback(async () => {
    if (!url.trim()) return;
    setStatus("loading");
    setError("");
    setProgressMsg("Submitting...");
    setProgressPct(2);
    setResult(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Server error (${res.status})`);
      }

      const { jobId } = await res.json();
      let failCount = 0;

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const jr = await fetch(`/api/jobs/${jobId}`);
          if (!jr.ok) {
            failCount++;
            if (failCount > 5) {
              clearInterval(pollRef.current);
              setError("Server connection lost. Please try again.");
              setStatus("error");
            }
            return;
          }
          failCount = 0;
          const job: JobStatus = await jr.json();

          if (job.status === "done" && job.result) {
            clearInterval(pollRef.current);
            setResult(job.result);
            setStatus("done");
            setProgressPct(100);
            return;
          }

          if (job.status === "error") {
            clearInterval(pollRef.current);
            setError(job.error || "Unknown error");
            setStatus("error");
            return;
          }

          if (job.progress) {
            setProgressMsg(job.progress.message || "Processing...");
            if (job.progress.total && job.progress.current) {
              setProgressPct(Math.round((job.progress.current / job.progress.total) * 100));
            }
          }

          if (job.status === "queued") {
            setProgressMsg("Waiting in queue...");
            setProgressPct(1);
          }
        } catch {
          failCount++;
          if (failCount > 5) {
            clearInterval(pollRef.current);
            setError("Network error. Please try again.");
            setStatus("error");
          }
        }
      }, 1000);
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }, [url]);

  const reset = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle");
    setResult(null);
    setUrl("");
    setProgressPct(0);
    setError("");
  }, []);

  return {
    url,
    setUrl,
    status,
    result,
    error,
    progressMsg,
    progressPct,
    handleScrape,
    reset,
  };
}
