import { useState, useCallback, useEffect, useRef } from "react";

interface Turn {
  index: number;
  role: string;
  content: string;
}

interface ScrapeResult {
  turns: Turn[];
  markdown: string;
  plainText: string;
  totalTurns: number;
  scrapedAt: string;
  elapsedSeconds: number;
}

interface JobStatus {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  progress?: { phase: string; message: string; total?: number; current?: number };
  result?: ScrapeResult;
  error?: string;
  url?: string;
  createdAt?: number;
  queueSize?: number;
}

type ExportFormat = "markdown" | "json" | "text";
type Status = "idle" | "loading" | "done" | "error";

const PLACEHOLDERS = [
  "chatgpt.com/share/your-conversation-id",
  "Paste any public ChatGPT share link...",
  "https://chatgpt.com/share/abc123...",
];

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState("");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [queuePos, setQueuePos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const i = setInterval(() => setPlaceholderIdx((p) => (p + 1) % PLACEHOLDERS.length), 3000);
    return () => { clearInterval(i); if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleScrape = useCallback(async () => {
    if (!url.trim()) return;
    setStatus("loading");
    setError("");
    setProgressMsg("Enqueueing job...");
    setProgressPct(0);
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

      const { jobId: jid } = await res.json();
      setJobId(jid);
      pollJob(jid);
    } catch (e: any) {
      setError(e.message);
      setStatus("error");
    }
  }, [url]);

  const pollJob = useCallback((jid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jid}`);
        if (!res.ok) return;
        const job: JobStatus = await res.json();

        setQueuePos(job.queueSize || 0);

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
          setProgressMsg(`In queue${job.queueSize ? ` (${job.queueSize} ahead)` : ""}...`);
          setProgressPct(1);
        }
      } catch { /* poll silent fail */ }
    }, 1000);
  }, []);

  const handleDownload = (format: ExportFormat) => {
    if (!result) return;
    let content = ""; let filename = "";
    switch (format) {
      case "markdown": content = result.markdown; filename = "chatgpt-conversation.md"; break;
      case "json": content = JSON.stringify(result.turns, null, 2); filename = "chatgpt-conversation.json"; break;
      case "text": content = result.plainText; filename = "chatgpt-conversation.txt"; break;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const reset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("idle"); setResult(null); setUrl(""); setProgressPct(0); setJobId(null); setQueuePos(0);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-grid">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#6C5CE7]/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#6C5CE7]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 py-16 relative">
          {/* Navbar */}
          <nav className="flex items-center justify-between mb-16 slide-up">
            <a href="https://www.pactis-ai.com" target="_blank" rel="noopener" className="flex items-center gap-2.5 text-[#a1a1aa] hover:text-[#f5f5f5] transition-colors">
              <PactisLogo />
              <span className="text-sm font-semibold tracking-wide">Pactis AI</span>
            </a>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6C5CE7]/10 border border-[#6C5CE7]/20 text-[#8B7CF6] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06D6A0] animate-pulse" />
              Live
            </span>
          </nav>

          {/* Hero */}
          <header className="text-center mb-12 slide-up">
            <h1 className="text-5xl font-bold tracking-tight mb-4 text-[#f5f5f5]">
              ChatGPT{" "}
              <span className="pactis-gradient-text">Exporter</span>
            </h1>
            <p className="text-[#a1a1aa] text-lg max-w-xl mx-auto leading-relaxed">
              Extract any public ChatGPT conversation into Markdown, JSON, or plain text — in one click.
            </p>
            <p className="text-[#52525b] text-sm mt-3 italic">We Rise by Lifting Others.</p>
          </header>

          {/* Input */}
          <div className={`mx-auto max-w-2xl transition-all duration-500 ${status === "done" ? "opacity-50 scale-95 pointer-events-none" : ""}`}>
            <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-1 glow-indigo">
              <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-xl p-2">
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#6C5CE7]/10 text-[#8B7CF6]">
                  <LinkIcon />
                </div>
                <input
                  ref={inputRef}
                  type="url"
                  placeholder={PLACEHOLDERS[placeholderIdx]}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                  className="flex-1 bg-transparent px-2 py-2 text-[#f5f5f5] placeholder-[#52525b] focus:outline-none text-sm"
                  disabled={status === "loading"}
                />
                {url && (
                  <button onClick={() => { setUrl(""); inputRef.current?.focus(); }} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1a1a1a] transition-colors cursor-pointer">
                    <XIcon />
                  </button>
                )}
                <button
                  onClick={handleScrape}
                  disabled={status === "loading" || !url.trim()}
                  className="flex-shrink-0 px-5 py-2.5 bg-[#6C5CE7] hover:bg-[#5A4BD1] text-white font-semibold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#6C5CE7]/20 text-sm"
                >
                  {status === "loading" ? "Extracting..." : "Extract"}
                </button>
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-4">
              {[
                { label: "Markdown", c: "text-[#06D6A0] border-[#06D6A0]/20 bg-[#06D6A0]/5" },
                { label: "JSON", c: "text-amber-400 border-amber-500/20 bg-amber-500/5" },
                { label: "Text", c: "text-sky-400 border-sky-500/20 bg-sky-500/5" },
                { label: "Queue-backed", c: "text-[#a1a1aa] border-[#2a2a2a] bg-[#121212]" },
              ].map((f) => (
                <span key={f.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${f.c}`}>{f.label}</span>
              ))}
            </div>
          </div>

          {/* Loading */}
          {status === "loading" && (
            <div className="max-w-lg mx-auto mt-12 slide-up">
              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-8 text-center">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-[#6C5CE7]/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-[#6C5CE7] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                  <div className="absolute inset-2 rounded-full bg-[#121212] flex items-center justify-center">
                    <span className="text-[#8B7CF6] text-xs font-mono font-bold">{progressPct}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-1 mb-3">
                  <span className="text-[#a1a1aa] font-medium text-sm">{progressMsg}</span>
                  {progressPct < 5 && (
                    <span className="inline-flex gap-1 ml-1">
                      <span className="w-1 h-1 rounded-full bg-[#6C5CE7] pulse-dot" />
                      <span className="w-1 h-1 rounded-full bg-[#6C5CE7] pulse-dot" />
                      <span className="w-1 h-1 rounded-full bg-[#6C5CE7] pulse-dot" />
                    </span>
                  )}
                </div>
                <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500 ease-out pactis-gradient" style={{ width: `${Math.max(progressPct, 2)}%` }} />
                </div>
                {jobId && (
                  <p className="text-[#3a3a3a] text-xs mt-4 font-mono">Job: {jobId.slice(0, 8)}...</p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="max-w-lg mx-auto mt-12 slide-up">
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-500/10">
                  <AlertIcon />
                </div>
                <h3 className="text-red-300 font-semibold mb-1">Extraction Failed</h3>
                <p className="text-red-400/70 text-sm mb-5">{error}</p>
                <button onClick={reset} className="px-5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-lg text-sm font-medium transition-colors cursor-pointer">Try Again</button>
              </div>
            </div>
          )}

          {/* Done */}
          {status === "done" && result && (
            <div className="max-w-4xl mx-auto mt-8 fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 slide-up">
                {[
                  { label: "Turns", value: result.totalTurns, icon: <MessageIcon />, color: "border-[#6C5CE7]/20 bg-[#6C5CE7]/5" },
                  { label: "Duration", value: `${result.elapsedSeconds}s`, icon: <ClockIcon />, color: "border-[#06D6A0]/20 bg-[#06D6A0]/5" },
                  { label: "Size", value: fmtBytes(result.markdown.length), icon: <FileIcon />, color: "border-amber-500/20 bg-amber-500/5" },
                  { label: "Words", value: result.plainText.split(/\s+/).length.toLocaleString(), icon: <HashIcon />, color: "border-sky-500/20 bg-sky-500/5" },
                ].map((s) => (
                  <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl border ${s.color}`}>
                    <div className="flex-shrink-0 opacity-70">{s.icon}</div>
                    <div><div className="text-xl font-bold text-[#f5f5f5]">{s.value}</div><div className="text-xs text-[#a1a1aa]">{s.label}</div></div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mb-4 flex-wrap gap-3 slide-up">
                <p className="text-sm text-[#a1a1aa]">Exported at <span className="text-[#f5f5f5]">{new Date(result.scrapedAt).toLocaleString()}</span></p>
                <div className="flex gap-2">
                  {(["markdown", "json", "text"] as ExportFormat[]).map((f) => (<DownloadBtn key={f} format={f} onClick={handleDownload} />))}
                </div>
              </div>

              <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-hidden slide-up">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
                  <span className="w-3 h-3 rounded-full bg-[#06D6A0]/60" />
                  <span className="ml-3 text-xs text-[#52525b] font-mono">preview</span>
                  <span className="ml-auto text-xs text-[#52525b]">{Math.min(30000, result.plainText.length).toLocaleString()} / {result.plainText.length.toLocaleString()} chars</span>
                </div>
                <div className="p-5 max-h-[55vh] overflow-y-auto">
                  <pre className="text-sm text-[#a1a1aa] whitespace-pre-wrap font-mono leading-relaxed">
                    {result.plainText.substring(0, 30000)}
                    {result.plainText.length > 30000 && (
                      <div className="mt-6 py-4 text-center border border-dashed border-[#2a2a2a] rounded-lg">
                        <p className="text-[#52525b] text-sm">Preview truncated at 30,000 characters</p>
                        <p className="text-[#3a3a3a] text-xs mt-1">Download the full export above</p>
                      </div>
                    )}
                  </pre>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button onClick={reset} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[#a1a1aa] hover:text-[#f5f5f5] hover:bg-[#121212] transition-colors text-sm cursor-pointer">
                  <RefreshIcon /> Extract Another
                </button>
              </div>
            </div>
          )}

          {/* Empty */}
          {status === "idle" && (
            <div className="max-w-md mx-auto mt-16 text-center fade-in">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-[#6C5CE7]/20 rounded-2xl blur-xl" />
                <div className="relative w-full h-full flex items-center justify-center rounded-2xl bg-[#121212] border border-[#2a2a2a]">
                  <BoltIcon />
                </div>
              </div>
              <h3 className="text-[#f5f5f5] font-semibold mb-2">Ready to Export</h3>
              <p className="text-[#52525b] text-sm leading-relaxed">
                Paste any public ChatGPT shared conversation link above.
                <br />The full conversation will be extracted and ready for download.
              </p>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-24 pt-8 border-t border-[#1a1a1a] text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PactisLogoSmall />
              <span className="text-[#52525b] text-xs">
                by <a href="https://www.pactis-ai.com" target="_blank" rel="noopener" className="text-[#8B7CF6] hover:text-[#6C5CE7] transition-colors">Pactis</a>
              </span>
            </div>
            <p className="text-[#3a3a3a] text-xs">We Rise by Lifting Others.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ── Download Button ── */
function DownloadBtn({ format, onClick }: { format: ExportFormat; onClick: (f: ExportFormat) => void }) {
  const c: Record<ExportFormat, { label: string; ext: string; cls: string }> = {
    markdown: { label: "Markdown", ext: ".md", cls: "text-[#06D6A0] border-[#06D6A0]/30 hover:border-[#06D6A0]/50 hover:bg-[#06D6A0]/10" },
    json: { label: "JSON", ext: ".json", cls: "text-amber-400 border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-500/10" },
    text: { label: "Text", ext: ".txt", cls: "text-sky-400 border-sky-500/30 hover:border-sky-400/50 hover:bg-sky-500/10" },
  };
  const { label, ext, cls } = c[format];
  return (
    <button onClick={() => onClick(format)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-[#0a0a0a] transition-all cursor-pointer text-sm font-medium ${cls}`}>
      <DownloadIcon /> {label} <span className="opacity-50 text-xs">{ext}</span>
    </button>
  );
}

/* ── Icons ── */
function PactisLogo() {
  return <svg width="24" height="24" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#6C5CE7"/><path d="M8 16L14 22L24 10" stroke="#f5f5f5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function PactisLogoSmall() {
  return <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#6C5CE7"/><path d="M8 16L14 22L24 10" stroke="#f5f5f5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function BoltIcon() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="#8B7CF6"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
}
function LinkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function AlertIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}
function DownloadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
function MessageIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#8B7CF6]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#06D6A0]"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function FileIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>;
}
function HashIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>;
}
function RefreshIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
