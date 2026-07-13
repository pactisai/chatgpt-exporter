import { MessageSquare, Clock, FileText, Hash } from "lucide-react";
import type { ScrapeResult } from "../types";

interface StatsGridProps {
  result: ScrapeResult;
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StatsGrid({ result }: StatsGridProps) {
  const stats = [
    { label: "Turns", value: result.totalTurns, icon: <MessageSquare size={18} className="text-[#8B7CF6]" />, color: "border-[#6C5CE7]/20 bg-[#6C5CE7]/5" },
    { label: "Duration", value: `${result.elapsedSeconds}s`, icon: <Clock size={18} className="text-[#06D6A0]" />, color: "border-[#06D6A0]/20 bg-[#06D6A0]/5" },
    { label: "Size", value: fmtBytes(result.markdown.length), icon: <FileText size={18} className="text-amber-400" />, color: "border-amber-500/20 bg-amber-500/5" },
    { label: "Words", value: result.plainText.split(/\s+/).length.toLocaleString(), icon: <Hash size={18} className="text-sky-400" />, color: "border-sky-500/20 bg-sky-500/5" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 slide-up">
      {stats.map((s) => (
        <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl border ${s.color}`}>
          <div className="flex-shrink-0 opacity-70">{s.icon}</div>
          <div>
            <div className="text-xl font-bold text-[#f5f5f5]">{s.value}</div>
            <div className="text-xs text-[#a1a1aa]">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
