import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface ProgressBarProps {
  isProcessing: boolean;
  stepMessage: string;
  progressPercent: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  isProcessing,
  stepMessage,
  progressPercent,
}) => {
  if (!isProcessing) return null;

  const isComplete = progressPercent >= 100;

  return (
    <div className="w-full max-w-xl mx-auto my-6 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-900 tracking-wide">
            {stepMessage || (isComplete ? 'Conversion Complete' : 'Processing...')}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
          {Math.min(100, Math.max(0, Math.round(progressPercent)))}%
        </span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete
              ? 'bg-emerald-500'
              : 'bg-indigo-600'
          }`}
          style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span>Processing entirely in your browser</span>
        <span>Zero server upload</span>
      </div>
    </div>
  );
};
