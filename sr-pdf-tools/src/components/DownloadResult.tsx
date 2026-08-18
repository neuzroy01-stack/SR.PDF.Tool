import React, { useState, useEffect } from 'react';
import {
  Download,
  RotateCcw,
  CheckCircle2,
  FileCheck,
  ArrowRight,
  Eye,
  ShieldCheck,
  Edit3,
  Check,
} from 'lucide-react';
import { ConversionResult, ToolId } from '../types';
import { formatBytes } from '../services/imageService';
import { triggerDownload } from '../services/zipService';
import { AdSlot } from './AdSlot';
import confetti from 'canvas-confetti';

interface DownloadResultProps {
  result: ConversionResult;
  onReset: () => void;
  onNavigateTool?: (toolId: ToolId) => void;
  onOpenAdmin?: () => void;
}

export const DownloadResult: React.FC<DownloadResultProps> = ({
  result,
  onReset,
  onNavigateTool,
  onOpenAdmin,
}) => {
  const [currentFileName, setCurrentFileName] = useState<string>(result.filename);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  useEffect(() => {
    setCurrentFileName(result.filename);
    // Fire subtle celebration confetti on result screen
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#10b981'],
        disableForReducedMotion: true,
      });
    } catch {
      // Ignore
    }
  }, [result]);

  const handleDownload = () => {
    // Preserve extension if stripped
    let finalName = currentFileName.trim();
    const originalExtMatch = result.filename.match(/\.[^/.]+$/);
    const originalExt = originalExtMatch ? originalExtMatch[0] : '';
    
    if (originalExt && !finalName.endsWith(originalExt)) {
      finalName = `${finalName}${originalExt}`;
    }

    triggerDownload(result.blob, finalName || result.filename);
  };

  const isImage =
    result.format.toLowerCase().includes('jpg') ||
    result.format.toLowerCase().includes('jpeg') ||
    result.format.toLowerCase().includes('png') ||
    result.format.toLowerCase().includes('webp') ||
    result.format.toLowerCase().includes('bmp');

  const isPdf = result.format.toLowerCase().includes('pdf');
  const isZip = result.format.toLowerCase().includes('zip');

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Result Top Ad Slot */}
      <AdSlot position="result-top" onOpenAdmin={onOpenAdmin} />

      {/* Main Success Container */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        {/* Success Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Ready to Download
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono border border-slate-200">
                  100% In-Browser
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-['Outfit']">
                Conversion Complete
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors self-start sm:self-auto border border-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Convert Another File
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 my-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Original Size
            </span>
            <p className="text-base sm:text-lg font-bold text-slate-800 mt-1 font-mono">
              {formatBytes(result.originalSize)}
            </p>
          </div>

          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">
              Output Size
            </span>
            <p className="text-base sm:text-lg font-bold text-emerald-700 mt-1 font-mono">
              {formatBytes(result.finalSize)}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Format
            </span>
            <p className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-mono uppercase">
              {result.format}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Optimization
            </span>
            <p className="text-base sm:text-lg font-bold text-indigo-600 mt-1 font-mono">
              {result.compressionRatio > 0 ? `-${result.compressionRatio}%` : 'Optimal'}
            </p>
          </div>
        </div>

        {/* Customizable File Name Bar */}
        <div className="my-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <span>Output File Name:</span>
          </div>

          <div className="flex-1 max-w-md flex items-center gap-2">
            <input
              type="text"
              value={currentFileName}
              onChange={(e) => setCurrentFileName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Filename"
            />
          </div>
        </div>

        {/* Preview Area */}
        <div className="my-6 bg-slate-50 rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" />
              File Output Preview
            </span>
            <span className="font-mono text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-md">
              {currentFileName}
            </span>
          </div>

          <div className="flex items-center justify-center min-h-[200px] max-h-[360px] bg-white rounded-xl overflow-hidden p-2 border border-slate-200">
            {isImage && (result.previewUrl || result.url) ? (
              <img
                src={result.previewUrl || result.url}
                alt={currentFileName}
                className="max-h-[340px] max-w-full object-contain rounded-lg shadow-xs"
              />
            ) : isPdf ? (
              <div className="text-center p-6 space-y-3">
                <FileCheck className="w-16 h-16 text-rose-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-900">{currentFileName}</p>
                <p className="text-xs text-slate-500">
                  {result.pageCount ? `${result.pageCount} Pages • ` : ''}PDF Ready for Download
                </p>
              </div>
            ) : isZip ? (
              <div className="text-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                  <Download className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{currentFileName}</p>
                <p className="text-xs text-slate-500">ZIP Archive Containing Converted Files</p>
              </div>
            ) : (
              <div className="text-center p-6">
                <FileCheck className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-900">{currentFileName}</p>
              </div>
            )}
          </div>
        </div>

        {/* AdSlot Before Download */}
        <AdSlot position="before-download" onOpenAdmin={onOpenAdmin} />

        {/* Prominent DOWNLOAD Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-4">
          <button
            id="download-result-btn"
            type="button"
            onClick={handleDownload}
            className="w-full sm:flex-1 py-4 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base sm:text-lg shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            <Download className="w-6 h-6" />
            DOWNLOAD FILE ({formatBytes(result.finalSize)})
          </button>

          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Convert Another
          </button>
        </div>

        {/* Next Step Recommendations */}
        {isImage && onNavigateTool && (
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">Continue working with this image:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateTool('image-editor')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-700 font-medium transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
              >
                Open in Image Editor <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTool('image-to-pdf')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-purple-700 font-medium transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
              >
                Convert to PDF <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Your files are processed in your browser and are not permanently stored on our servers.</span>
        </div>
      </div>
    </div>
  );
};
