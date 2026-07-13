import { Download } from "lucide-react";
import type { ExportFormat } from "../types";

interface DownloadButtonsProps {
  onDownload: (format: ExportFormat) => void;
}

const BTN_CONFIG: Record<ExportFormat, { label: string; ext: string; cls: string }> = {
  markdown: {
    label: "Markdown",
    ext: ".md",
    cls: "text-[#06D6A0] border-[#06D6A0]/30 hover:border-[#06D6A0]/50 hover:bg-[#06D6A0]/10",
  },
  json: {
    label: "JSON",
    ext: ".json",
    cls: "text-amber-400 border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-500/10",
  },
  text: {
    label: "Text",
    ext: ".txt",
    cls: "text-sky-400 border-sky-500/30 hover:border-sky-400/50 hover:bg-sky-500/10",
  },
};

export default function DownloadButtons({ onDownload }: DownloadButtonsProps) {
  return (
    <div className="flex gap-2">
      {(Object.keys(BTN_CONFIG) as ExportFormat[]).map((format) => {
        const { label, ext, cls } = BTN_CONFIG[format];
        return (
          <button
            key={format}
            onClick={() => onDownload(format)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-[#0a0a0a] transition-all cursor-pointer text-sm font-medium ${cls}`}
          >
            <Download size={14} /> {label} <span className="opacity-50 text-xs">{ext}</span>
          </button>
        );
      })}
    </div>
  );
}
