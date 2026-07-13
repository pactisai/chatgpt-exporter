interface PreviewTerminalProps {
  content: string;
  charLimit?: number;
}

export default function PreviewTerminal({ content, charLimit = 30000 }: PreviewTerminalProps) {
  const truncated = content.substring(0, charLimit);

  return (
    <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl overflow-hidden slide-up">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2a2a2a] bg-[#0a0a0a]">
        <span className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
        <span className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
        <span className="w-3 h-3 rounded-full bg-[#06D6A0]/60" />
        <span className="ml-3 text-xs text-[#52525b] font-mono">preview</span>
        <span className="ml-auto text-xs text-[#52525b]">
          {Math.min(charLimit, content.length).toLocaleString()} / {content.length.toLocaleString()} chars
        </span>
      </div>
      <div className="p-5 max-h-[55vh] overflow-y-auto">
        <pre className="text-sm text-[#a1a1aa] whitespace-pre-wrap font-mono leading-relaxed">
          {truncated}
          {content.length > charLimit && (
            <div className="mt-6 py-4 text-center border border-dashed border-[#2a2a2a] rounded-lg">
              <p className="text-[#52525b] text-sm">Preview truncated at {charLimit.toLocaleString()} characters</p>
              <p className="text-[#3a3a3a] text-xs mt-1">Download the full export above</p>
            </div>
          )}
        </pre>
      </div>
    </div>
  );
}
