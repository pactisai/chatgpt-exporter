export interface Turn {
  index: number;
  role: string;
  content: string;
}

export interface ScrapeResult {
  turns: Turn[];
  markdown: string;
  plainText: string;
  totalTurns: number;
  scrapedAt: string;
  elapsedSeconds: number;
}

export interface JobStatus {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  progress?: { phase: string; message: string; total?: number; current?: number };
  result?: ScrapeResult;
  error?: string;
}

export type ExportFormat = "markdown" | "json" | "text";
export type Status = "idle" | "loading" | "done" | "error";
