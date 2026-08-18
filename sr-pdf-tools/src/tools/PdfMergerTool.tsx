import React, { useState } from 'react';
import { ConversionResult, ProcessingState } from '../types';
import { mergePdfFiles, getPdfDetails } from '../services/pdfService';
import { formatBytes } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import { FileText, MoveUp, MoveDown, Trash2, ArrowRight, RefreshCw, Plus, Layers } from 'lucide-react';

interface PdfMergerToolProps {
  onOpenAdmin?: () => void;
}

interface PdfItem {
  id: string;
  file: File;
  pageCount?: number;
}

export const PdfMergerTool: React.FC<PdfMergerToolProps> = ({ onOpenAdmin }) => {
  const [pdfItems, setPdfItems] = useState<PdfItem[]>([]);
  const [outputFilename, setOutputFilename] = useState<string>('merged_document.pdf');
  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    const newItems: PdfItem[] = [];

    for (const f of files) {
      let pages: number | undefined;
      try {
        const details = await getPdfDetails(f);
        pages = details.pageCount;
      } catch {
        // Ignore
      }

      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file: f,
        pageCount: pages,
      });
    }

    setPdfItems((prev) => [...prev, ...newItems]);
    setResult(null);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const items = [...pdfItems];
      const temp = items[index - 1];
      items[index - 1] = items[index];
      items[index] = temp;
      setPdfItems(items);
    } else if (direction === 'down' && index < pdfItems.length - 1) {
      const items = [...pdfItems];
      const temp = items[index + 1];
      items[index + 1] = items[index];
      items[index] = temp;
      setPdfItems(items);
    }
  };

  const handleRemove = (id: string) => {
    setPdfItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMerge = async () => {
    if (pdfItems.length < 2) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Reading PDF documents...',
      progressPercent: 10,
      error: null,
    });

    try {
      const rawFiles = pdfItems.map((p) => p.file);
      const totalOrigBytes = rawFiles.reduce((acc, f) => acc + f.size, 0);

      const mergedBlob = await mergePdfFiles(rawFiles, (msg, pct) => {
        setProcState({
          isProcessing: true,
          stepMessage: msg,
          progressPercent: pct,
          error: null,
        });
      });

      const totalPages = pdfItems.reduce((acc, p) => acc + (p.pageCount || 0), 0);
      const previewUrl = URL.createObjectURL(mergedBlob);
      const finalName = outputFilename.endsWith('.pdf') ? outputFilename : `${outputFilename}.pdf`;

      setResult({
        blob: mergedBlob,
        url: previewUrl,
        filename: finalName,
        originalSize: totalOrigBytes,
        finalSize: mergedBlob.size,
        format: 'Merged PDF',
        compressionRatio: 0,
        pageCount: totalPages,
      });

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('Merge error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to merge PDF files.',
      });
    }
  };

  const handleReset = () => {
    setPdfItems([]);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  const totalPages = pdfItems.reduce((acc, p) => acc + (p.pageCount || 0), 0);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdSlot position="pdf-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          PDF Merger
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Combine multiple PDF documents into a single organized file with drag & drop sequence ordering.
        </p>
      </div>

      {result ? (
        <DownloadResult
          result={result}
          onReset={handleReset}
          onOpenAdmin={onOpenAdmin}
        />
      ) : (
        <div className="space-y-6">
          <FileUploader
            accept=".pdf,application/pdf"
            multiple={true}
            title="Upload PDF Files to Merge"
            subtitle="Select 2 or more PDF documents"
            onFilesSelected={handleFilesSelected}
          />

          {pdfItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Merge Sequence ({pdfItems.length} Files • {totalPages} Total Pages)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* PDF List */}
              <div className="space-y-2.5">
                {pdfItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 shadow-xs">
                        {index + 1}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 truncate">{item.file.name}</p>
                        <p className="text-slate-500 font-mono text-[11px]">
                          {formatBytes(item.file.size)} {item.pageCount ? `• ${item.pageCount} Pages` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 shadow-xs cursor-pointer"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === pdfItems.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 shadow-xs cursor-pointer"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Output Filename */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Output Merged File Name:
                </label>
                <input
                  type="text"
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <ProgressBar
                isProcessing={procState.isProcessing}
                stepMessage={procState.stepMessage}
                progressPercent={procState.progressPercent}
              />

              {procState.error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {procState.error}
                </div>
              )}

              {/* Merge Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing || pdfItems.length < 2}
                onClick={handleMerge}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Merging {pdfItems.length} PDF Documents...
                  </>
                ) : (
                  <>
                    Merge {pdfItems.length} PDF Files ({totalPages} Pages)
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
