import React, { useState } from 'react';
import { ConversionResult, ProcessingState } from '../types';
import { splitPdfDocument, getPdfDetails } from '../services/pdfService';
import { createAndDownloadZip } from '../services/zipService';
import { formatBytes } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import { FileText, Scissors, Layers, ArrowRight, RefreshCw } from 'lucide-react';

interface PdfSplitterToolProps {
  onOpenAdmin?: () => void;
}

export const PdfSplitterTool: React.FC<PdfSplitterToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<'range' | 'all' | 'selected'>('range');
  const [rangeInput, setRangeInput] = useState<string>('1-2');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setResult(null);

    try {
      const details = await getPdfDetails(file);
      setPageCount(details.pageCount);
      setRangeInput(`1-${Math.min(3, details.pageCount)}`);
      setSelectedPages([1]);
    } catch {
      // Ignore
    }
  };

  const handleTogglePage = (pageNum: number) => {
    if (selectedPages.includes(pageNum)) {
      setSelectedPages(selectedPages.filter((p) => p !== pageNum));
    } else {
      setSelectedPages([...selectedPages, pageNum].sort((a, b) => a - b));
    }
  };

  const handleSplit = async () => {
    if (!selectedFile) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Extracting PDF pages...',
      progressPercent: 15,
      error: null,
    });

    try {
      const outputs = await splitPdfDocument(
        selectedFile,
        splitMode,
        {
          pageRangeStr: rangeInput,
          selectedPages,
        },
        (msg, pct) => {
          setProcState({
            isProcessing: true,
            stepMessage: msg,
            progressPercent: pct,
            error: null,
          });
        }
      );

      if (outputs.length === 1) {
        // Single extracted PDF
        const single = outputs[0];
        const previewUrl = URL.createObjectURL(single.blob);
        setResult({
          blob: single.blob,
          url: previewUrl,
          filename: single.filename,
          originalSize: selectedFile.size,
          finalSize: single.blob.size,
          format: 'Extracted PDF',
          compressionRatio: 0,
        });
      } else {
        // Multiple single-page PDFs into ZIP
        setProcState({
          isProcessing: true,
          stepMessage: 'Archiving split PDFs into ZIP...',
          progressPercent: 90,
          error: null,
        });

        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
        const zipFiles = outputs.map((p) => ({ name: p.filename, blob: p.blob }));
        const zipBlob = await createAndDownloadZip(zipFiles, `${baseName}_split_pages.zip`);
        const previewUrl = URL.createObjectURL(zipBlob);

        setResult({
          blob: zipBlob,
          url: previewUrl,
          filename: `${baseName}_split_pages.zip`,
          originalSize: selectedFile.size,
          finalSize: zipBlob.size,
          format: `ZIP (${outputs.length} Split PDFs)`,
          compressionRatio: 0,
        });
      }

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('Split error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to split PDF document.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPageCount(0);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdSlot position="pdf-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          PDF Splitter & Page Extractor
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Extract specific page ranges, extract selected pages, or split every single page into separate PDF documents.
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
            multiple={false}
            title="Upload PDF Document to Split"
            subtitle="Drop your PDF document here"
            selectedFiles={selectedFile ? [selectedFile] : []}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFile && pageCount > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                    {selectedFile.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {pageCount} Total Pages • {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>

              {/* Split Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Choose Split Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setSplitMode('range')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      splitMode === 'range'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">Page Range</div>
                    <div className="text-xs opacity-75 mt-0.5">e.g. 1-3, 5</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSplitMode('selected')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      splitMode === 'selected'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">Select Pages</div>
                    <div className="text-xs opacity-75 mt-0.5">Interactive grid</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSplitMode('all')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      splitMode === 'all'
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">Split Every Page</div>
                    <div className="text-xs opacity-75 mt-0.5">ZIP Archive</div>
                  </button>
                </div>
              </div>

              {/* Mode Specific Inputs */}
              {splitMode === 'range' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Enter Page Ranges to Extract (1 to {pageCount}):
                  </label>
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="e.g. 1-3, 5"
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm text-slate-900 font-mono outline-none focus:border-indigo-500 shadow-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Use commas to separate pages or dashes for ranges (e.g. <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">1-4, 7, 9-10</code>).
                  </p>
                </div>
              )}

              {splitMode === 'selected' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Click pages to include in the extracted PDF:
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200">
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => {
                      const isSelected = selectedPages.includes(pageNum);
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => handleTogglePage(pageNum)}
                          className={`p-2.5 rounded-xl border text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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

              {/* Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleSplit}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Extracting PDF Pages...
                  </>
                ) : (
                  <>
                    {splitMode === 'all' ? `Split All ${pageCount} Pages to ZIP` : 'Extract PDF Pages'}
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
