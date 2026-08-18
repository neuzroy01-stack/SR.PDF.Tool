import React, { useState } from 'react';
import { ConversionResult, ProcessingState } from '../types';
import { enhanceDocumentScan, formatBytes, loadImage } from '../services/imageService';
import { imagesToPdf } from '../services/pdfService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import { Sparkles, Sliders, FileText, Image as ImageIcon, ArrowRight, RefreshCw, Eye } from 'lucide-react';

interface DocumentScannerToolProps {
  onOpenAdmin?: () => void;
}

export const DocumentScannerTool: React.FC<DocumentScannerToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contrastBoost, setContrastBoost] = useState<number>(1.4); // 1.0 - 2.5
  const [brightness, setBrightness] = useState<number>(18); // 0 - 60
  const [isGrayscale, setIsGrayscale] = useState<boolean>(true);
  const [isSharpen, setIsSharpen] = useState<boolean>(true);
  const [exportType, setExportType] = useState<'pdf' | 'png' | 'jpeg'>('pdf');

  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    setSelectedFile(files[0]);
    setResult(null);
  };

  const handleEnhance = async () => {
    if (!selectedFile) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Analyzing document paper texture & text ink...',
      progressPercent: 20,
      error: null,
    });

    try {
      const img = await loadImage(selectedFile);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(img, 0, 0);

      setProcState({
        isProcessing: true,
        stepMessage: 'Applying contrast normalization and background whitening...',
        progressPercent: 50,
        error: null,
      });

      enhanceDocumentScan(ctx, canvas.width, canvas.height, {
        contrastBoost,
        brightnessOffset: brightness,
        grayscale: isGrayscale,
        sharpen: isSharpen,
      });

      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');

      if (exportType === 'pdf') {
        setProcState({
          isProcessing: true,
          stepMessage: 'Formatting into crisp PDF document...',
          progressPercent: 80,
          error: null,
        });

        const enhancedBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92));
        const enhancedFile = new File([enhancedBlob], `${baseName}_enhanced.jpg`, { type: 'image/jpeg' });
        const pdfBlob = await imagesToPdf(
          [
            {
              id: '1',
              file: enhancedFile,
              name: enhancedFile.name,
              type: enhancedFile.type,
              previewUrl: URL.createObjectURL(enhancedBlob),
              size: enhancedBlob.size,
              rotation: 0,
            },
          ],
          { pageSize: 'a4', orientation: 'portrait', margin: 'normal' }
        );

        const previewUrl = URL.createObjectURL(pdfBlob);
        setResult({
          blob: pdfBlob,
          url: previewUrl,
          filename: `${baseName}_scanned.pdf`,
          originalSize: selectedFile.size,
          finalSize: pdfBlob.size,
          format: 'Scanned Document (PDF)',
          compressionRatio: Math.max(0, Math.round(((selectedFile.size - pdfBlob.size) / selectedFile.size) * 100)),
          previewUrl: URL.createObjectURL(enhancedBlob),
        });
      } else {
        const mime = exportType === 'png' ? 'image/png' : 'image/jpeg';
        const enhancedBlob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), mime, 0.95));
        const previewUrl = URL.createObjectURL(enhancedBlob);

        setResult({
          blob: enhancedBlob,
          url: previewUrl,
          filename: `${baseName}_scanned.${exportType === 'png' ? 'png' : 'jpg'}`,
          originalSize: selectedFile.size,
          finalSize: enhancedBlob.size,
          format: `Enhanced Image (${exportType.toUpperCase()})`,
          compressionRatio: Math.max(0, Math.round(((selectedFile.size - enhancedBlob.size) / selectedFile.size) * 100)),
          previewUrl,
        });
      }

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('Scan error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to enhance document scan.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdSlot position="image-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-1 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          Intelligent Document Cleaner
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Document Scanner & Paper Enhancer
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Convert camera photos of papers, receipts, and notes into clean, high-contrast, scanner-quality documents.
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
            accept="image/*"
            multiple={false}
            title="Upload Document Photo"
            subtitle="Drop a phone photo of a document, note, or receipt"
            selectedFiles={selectedFile ? [selectedFile] : []}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFile && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {selectedFile.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Original Size: {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings sliders */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Scanner Filter Tuning
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Contrast Ink Boost:</span>
                      <span className="font-mono text-emerald-600 font-bold">{Math.round(contrastBoost * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.5"
                      step="0.1"
                      value={contrastBoost}
                      onChange={(e) => setContrastBoost(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs text-slate-700">
                      <span>Background Whitening:</span>
                      <span className="font-mono text-emerald-600 font-bold">+{brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="2"
                      value={brightness}
                      onChange={(e) => setBrightness(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsGrayscale(!isGrayscale)}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                      isGrayscale
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    B&W / Grayscale
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSharpen(!isSharpen)}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                      isSharpen
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    Sharpen Text
                  </button>
                </div>
              </div>

              {/* Output format */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Output Format
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setExportType('pdf')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                      exportType === 'pdf'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    PDF Document
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('png')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                      exportType === 'png'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    PNG Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportType('jpeg')}
                    className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors cursor-pointer ${
                      exportType === 'jpeg'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    JPG Image
                  </button>
                </div>
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

              {/* Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleEnhance}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Cleaning Document...
                  </>
                ) : (
                  <>
                    Enhance & Clean Document Scan
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
