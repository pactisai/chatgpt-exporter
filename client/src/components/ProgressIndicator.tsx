interface ProgressIndicatorProps {
  progressPct: number;
  progressMsg: string;
}

export default function ProgressIndicator({ progressPct, progressMsg }: ProgressIndicatorProps) {
  return (
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
          <div
            className="h-full rounded-full transition-all duration-500 ease-out pactis-gradient"
            style={{ width: `${Math.max(progressPct, 2)}%` }}
          />
        </div>
        <p className="text-[#52525b] text-xs mt-4">Large conversations may take 1–2 minutes. Live progress streaming.</p>
      </div>
    </div>
  );
}
