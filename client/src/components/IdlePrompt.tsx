import { Zap } from "lucide-react";

export default function IdlePrompt() {
  return (
    <div className="max-w-md mx-auto mt-16 text-center fade-in">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="absolute inset-0 bg-[#6C5CE7]/20 rounded-2xl blur-xl" />
        <div className="relative w-full h-full flex items-center justify-center rounded-2xl bg-[#121212] border border-[#2a2a2a]">
          <Zap size={32} fill="#8B7CF6" color="#8B7CF6" />
        </div>
      </div>
      <h3 className="text-[#f5f5f5] font-semibold mb-2">Ready to Export</h3>
      <p className="text-[#52525b] text-sm leading-relaxed">
        Paste any public ChatGPT shared conversation link above.
        <br />The full conversation will be extracted and ready for download.
      </p>
    </div>
  );
}
