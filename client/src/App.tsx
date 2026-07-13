import { useState, useEffect } from "react";
import { RotateCw } from "lucide-react";
import { useScrapeJob } from "./hooks/useScrapeJob";
import URLInput from "./components/URLInput";
import ProgressIndicator from "./components/ProgressIndicator";
import ErrorDisplay from "./components/ErrorDisplay";
import StatsGrid from "./components/StatsGrid";
import DownloadButtons from "./components/DownloadButtons";
import PreviewTerminal from "./components/PreviewTerminal";
import IdlePrompt from "./components/IdlePrompt";
import { PactisLogo, PactisLogoSmall } from "./components/Logo";
import type { ExportFormat } from "./types";

const PLACEHOLDERS = [
  "chatgpt.com/share/your-conversation-id",
  "Paste any public ChatGPT share link...",
  "https://chatgpt.com/share/abc123...",
];

export default function App() {
  const {
    url,
    setUrl,
    status,
    result,
    error,
    progressMsg,
    progressPct,
    handleScrape,
    reset,
  } = useScrapeJob();

  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const i = setInterval(
      () => setPlaceholderIdx((p) => (p + 1) % PLACEHOLDERS.length),
      3000,
    );
    return () => clearInterval(i);
  }, []);

  const handleDownload = (format: ExportFormat) => {
    if (!result) return;
    let content = "";
    let filename = "";
    switch (format) {
      case "markdown":
        content = result.markdown;
        filename = "chatgpt-conversation.md";
        break;
      case "json":
        content = JSON.stringify(result.turns, null, 2);
        filename = "chatgpt-conversation.json";
        break;
      case "text":
        content = result.plainText;
        filename = "chatgpt-conversation.txt";
        break;
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] bg-grid">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#6C5CE7]/8 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#6C5CE7]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 py-16 relative">
          {/* NAV */}
          <nav className="flex items-center justify-between mb-16 slide-up">
            <a
              href="https://www.pactis-ai.com"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2.5 text-[#a1a1aa] hover:text-[#f5f5f5] transition-colors"
            >
              <PactisLogo />
              <span className="text-sm font-semibold tracking-wide">Pactis AI</span>
            </a>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6C5CE7]/10 border border-[#6C5CE7]/20 text-[#8B7CF6] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06D6A0] animate-pulse" />
              Live
            </span>
          </nav>

          {/* HEADER */}
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

          {/* URL INPUT SECTION */}
          <div
            className={`mx-auto max-w-2xl transition-all duration-500 ${
              status === "done" ? "opacity-50 scale-95 pointer-events-none" : ""
            }`}
          >
            <URLInput
              url={url}
              setUrl={setUrl}
              onSubmit={handleScrape}
              isLoading={status === "loading"}
              placeholderIdx={placeholderIdx}
            />
            <div className="flex justify-center gap-3 mt-4">
              {[
                { label: "Markdown", c: "text-[#06D6A0] border-[#06D6A0]/20 bg-[#06D6A0]/5" },
                { label: "JSON", c: "text-amber-400 border-amber-500/20 bg-amber-500/5" },
                { label: "Text", c: "text-sky-400 border-sky-500/20 bg-sky-500/5" },
                { label: "Open Source", c: "text-[#a1a1aa] border-[#2a2a2a] bg-[#121212]" },
              ].map((f) => (
                <span
                  key={f.label}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${f.c}`}
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          {/* LOADING STATE */}
          {status === "loading" && (
            <ProgressIndicator progressPct={progressPct} progressMsg={progressMsg} />
          )}

          {/* ERROR STATE */}
          {status === "error" && (
            <ErrorDisplay error={error} onReset={reset} />
          )}

          {/* DONE STATE */}
          {status === "done" && result && (
            <div className="max-w-4xl mx-auto mt-8 fade-in">
              <StatsGrid result={result} />

              <div className="flex items-center justify-between mb-4 flex-wrap gap-3 slide-up">
                <p className="text-sm text-[#a1a1aa]">
                  Exported at{" "}
                  <span className="text-[#f5f5f5]">
                    {new Date(result.scrapedAt).toLocaleString()}
                  </span>
                </p>
                <DownloadButtons onDownload={handleDownload} />
              </div>

              <PreviewTerminal content={result.plainText} />

              <div className="mt-6 text-center">
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[#a1a1aa] hover:text-[#f5f5f5] hover:bg-[#121212] transition-colors text-sm cursor-pointer"
                >
                  <RotateCw size={14} /> Extract Another
                </button>
              </div>
            </div>
          )}

          {/* IDLE STATE */}
          {status === "idle" && <IdlePrompt />}

          {/* FOOTER */}
          <footer className="mt-24 pt-8 border-t border-[#1a1a1a] text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PactisLogoSmall />
              <span className="text-[#52525b] text-xs">
                by{" "}
                <a
                  href="https://www.pactis-ai.com"
                  target="_blank"
                  rel="noopener"
                  className="text-[#8B7CF6] hover:text-[#6C5CE7] transition-colors"
                >
                  Pactis
                </a>
              </span>
            </div>
            <p className="text-[#3a3a3a] text-xs">We Rise by Lifting Others.</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
