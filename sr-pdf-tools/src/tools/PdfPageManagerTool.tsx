import React, { useState, useEffect } from 'react';
import { ConversionResult, PdfPageItem, ProcessingState } from '../types';
import { managePdfPages, renderPdfPageToCanvas, getPdfDetails } from '../services/pdfService';
import { formatBytes } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import {
  FileText,
  RotateCw,
  Trash2,
  MoveLeft,
  MoveRight,
  ArrowRight,
  RefreshCw,
  Eye,
  Layers,
} from 'lucide-react';

interface PdfPageManagerToolProps {
  onOpenAdmin?: () => void;
}

export const PdfPageManagerTool: React.FC<PdfPageManagerToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState<boolean>(false);

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
    setIsLoadingPreviews(true);

    try {
      const details = await getPdfDetails(file);
      const totalPages = details.pageCount;

      const initialPages: PdfPageItem[] = Array.from({ length: totalPages }, (_, i) => ({
        pageNumber: i + 1,
        originalPageNumber: i + 1,
        rotation: 0,
      }));
      setPages(initialPages);

      // Render low-res preview thumbnails asynchronously
      const buffer = await file.arrayBuffer();
      const updatedPages = [...initialPages];

      for (let i = 1; i <= Math.min(totalPages, 30); i++) {
        try {
          const canvas = await renderPdfPageToCanvas(buffer, i, 0.4);
          updatedPages[i - 1].previewUrl = canvas.toDataURL('image/jpeg', 0.7);
          setPages([...updatedPages]);
        } catch {
          // ignore thumbnail preview error
        }
      }
    } catch (err: any) {
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to load PDF pages.',
      });
    } finally {
      setIsLoadingPreviews(false);
    }
  };

  const handleRotatePage = (index: number) => {
    setPages((prev) =>
      prev.map((p, i) => (i === index ? { ...p, rotation: (p.rotation + 90) % 360 } : p))
    );
  };

  const handleDeletePage = (index: number) => {
    if (pages.length <= 1) {
      alert('A PDF document must contain at least one page.');
      return;
    }
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMovePage = (index: number, direction: 'left' | 'right') => {
    if (direction === 'left' && index > 0) {
      const copy = [...pages];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      setPages(copy);
    } else if (direction === 'right' && index < pages.length - 1) {
      const copy = [...pages];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      setPages(copy);
    }
  };

  const handleSaveUpdatedPdf = async () => {
    if (!selectedFile || pages.length === 0) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Applying page rotations and structure...',
      progressPercent: 20,
      error: null,
    });

    try {
      const pdfBlob = await managePdfPages(selectedFile, pages, (msg, pct) => {
        setProcState({
          isProcessing: true,
          stepMessage: msg,
          progressPercent: pct,
          error: null,
        });
      });

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const outName = `${baseName}_organized.pdf`;
      const previewUrl = URL.createObjectURL(pdfBlob);

      setResult({
        blob: pdfBlob,
        url: previewUrl,
        filename: outName,
        originalSize: selectedFile.size,
        finalSize: pdfBlob.size,
        format: 'Organized PDF',
        compressionRatio: 0,
        pageCount: pages.length,
      });

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('Page manager error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to save updated PDF.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPages([]);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <AdSlot position="pdf-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          PDF Page Manager & Organizer
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Rotate individual pages, delete unwanted pages, and reorder document sequence visually in your browser.
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
            title="Upload PDF to Organize"
            subtitle="Drop PDF to view and manage pages"
            selectedFiles={selectedFile ? [selectedFile] : []}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFile && pages.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {pages.length} Pages remaining • {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-medium cursor-pointer"
                  >
                    Change PDF
                  </button>
                </div>
              </div>

              {/* Visual Pages Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {pages.map((item, index) => (
                  <div
                    key={`${item.originalPageNumber}-${index}`}
                    className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-col space-y-2 relative group hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-xs">
                        #{index + 1}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Orig: #{item.originalPageNumber}
                      </span>
                    </div>

                    {/* Page Thumbnail */}
                    <div className="h-44 rounded-xl bg-white overflow-hidden flex items-center justify-center p-2 border border-slate-200 shadow-inner">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={`Page ${item.originalPageNumber}`}
                          style={{ transform: `rotate(${item.rotation}deg)` }}
                          className="max-h-full max-w-full object-contain rounded shadow-xs transition-transform duration-200"
                        />
                      ) : (
                        <div className="text-center p-2 text-slate-400 text-xs">
                          <FileText className="w-8 h-8 mx-auto mb-1 text-slate-400" />
                          <span>Page {item.originalPageNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Page Action Controls */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePage(index, 'left')}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 shadow-xs cursor-pointer"
                          title="Move Left"
                        >
                          <MoveLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === pages.length - 1}
                          onClick={() => handleMovePage(index, 'right')}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 shadow-xs cursor-pointer"
                          title="Move Right"
                        >
                          <MoveRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotatePage(index)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-indigo-600 shadow-xs cursor-pointer font-medium"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePage(index)}
                        className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 shadow-xs cursor-pointer"
                        title="Delete Page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
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

              {/* Save Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleSaveUpdatedPdf}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Saving PDF Document...
                  </>
                ) : (
                  <>
                    Save & Download PDF ({pages.length} Pages)
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
