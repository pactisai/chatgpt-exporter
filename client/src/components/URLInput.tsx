import { useRef } from "react";
import { Link, X } from "lucide-react";

interface URLInputProps {
  url: string;
  setUrl: (url: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholderIdx: number;
}

const PLACEHOLDERS = [
  "chatgpt.com/share/your-conversation-id",
  "Paste any public ChatGPT share link...",
  "https://chatgpt.com/share/abc123...",
];

export default function URLInput({ url, setUrl, onSubmit, isLoading, placeholderIdx }: URLInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-[#121212] border border-[#2a2a2a] rounded-2xl p-1 glow-indigo">
      <div className="flex items-center gap-2 bg-[#0a0a0a] rounded-xl p-2">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-[#6C5CE7]/10 text-[#8B7CF6]">
          <Link size={18} />
        </div>
        <input
          ref={inputRef}
          type="url"
          placeholder={PLACEHOLDERS[placeholderIdx]}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          className="flex-1 bg-transparent px-2 py-2 text-[#f5f5f5] placeholder-[#52525b] focus:outline-none text-sm"
          disabled={isLoading}
        />
        {url && (
          <button
            onClick={() => { setUrl(""); inputRef.current?.focus(); }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={isLoading || !url.trim()}
          className="flex-shrink-0 px-5 py-2.5 bg-[#6C5CE7] hover:bg-[#5A4BD1] text-white font-semibold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#6C5CE7]/20 text-sm"
        >
          {isLoading ? "Extracting..." : "Extract"}
        </button>
      </div>
    </div>
  );
}
