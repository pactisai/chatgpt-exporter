import { AlertTriangle } from "lucide-react";

interface ErrorDisplayProps {
  error: string;
  onReset: () => void;
}

export default function ErrorDisplay({ error, onReset }: ErrorDisplayProps) {
  return (
    <div className="max-w-lg mx-auto mt-12 slide-up">
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <h3 className="text-red-300 font-semibold mb-1">Extraction Failed</h3>
        <p className="text-red-400/70 text-sm mb-5">{error}</p>
        <button
          onClick={onReset}
          className="px-5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
