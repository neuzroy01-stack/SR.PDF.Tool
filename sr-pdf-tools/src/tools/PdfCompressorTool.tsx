import React, { useState, useEffect } from 'react';
import { ConversionResult, ProcessingState } from '../types';
import { compressPdfDocument, getPdfDetails } from '../services/pdfService';
import { formatBytes } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import {
  FileText,
  Sliders,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Info,
  Lock,
  Key,
  Eye,
  EyeOff,
  Edit3,
} from 'lucide-react';

interface PdfCompressorToolProps {
  onOpenAdmin?: () => void;
}

export const PdfCompressorTool: React.FC<PdfCompressorToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  
  // Slider value: 0 (Min Compression / Best Quality) to 100 (Max Compression / Smallest Size)
  const [compressionSlider, setCompressionSlider] = useState<number>(60);
  
  // Custom Output File Name
  const [customFileName, setCustomFileName] = useState<string>('');

  // Password Protection State
  const [isPasswordRequired, setIsPasswordRequired] = useState<boolean>(false);
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);

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
    setIsPasswordRequired(false);
    setPdfPassword('');
    
    // Set smart default output name
    const defaultName = file.name.replace(/\.[^/.]+$/, '') + '_compressed';
    setCustomFileName(defaultName);

    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });

    try {
      const details = await getPdfDetails(file);
      setPageCount(details.pageCount);
    } catch (err: any) {
      console.warn('PDF details read note:', err);
      if (err.isPasswordProtected) {
        setIsPasswordRequired(true);
      }
    }
  };

  const calculateEstimatedSize = () => {
    if (!selectedFile) return { min: 0, max: 0, label: '' };
    const origBytes = selectedFile.size;
    const compRatio = compressionSlider / 100;

    const factorMin = Math.max(0.12, 0.70 - compRatio * 0.55);
    const factorMax = Math.max(0.25, 0.90 - compRatio * 0.55);

    const estMin = Math.max(20 * 1024, Math.round(origBytes * factorMin));
    const estMax = Math.max(estMin + 15 * 1024, Math.round(origBytes * factorMax));

    return {
      min: estMin,
      max: estMax,
      label: `${formatBytes(estMin)} – ${formatBytes(estMax)}`,
    };
  };

  const estSize = calculateEstimatedSize();

  const handleCompress = async () => {
    if (!selectedFile) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Analyzing PDF pages and compressing document structure...',
      progressPercent: 10,
      error: null,
    });

    try {
      const res = await compressPdfDocument(
        selectedFile,
        compressionSlider,
        {
          password: pdfPassword || undefined,
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

      const previewUrl = URL.createObjectURL(res.blob);
      
      // Determine final output filename
      const baseClean = customFileName.trim() || selectedFile.name.replace(/\.[^/.]+$/, '') + '_compressed';
      const finalFileName = baseClean.endsWith('.pdf') ? baseClean : `${baseClean}.pdf`;

      setResult({
        blob: res.blob,
        url: previewUrl,
        filename: finalFileName,
        originalSize: res.originalSize,
        finalSize: res.finalSize,
        format: 'PDF (Compressed)',
        compressionRatio: res.compressionRatio,
        pageCount,
      });

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
      setIsPasswordRequired(false);
    } catch (err: any) {
      console.error('PDF compression error:', err);

      if (err.isPasswordProtected) {
        setIsPasswordRequired(true);
        setProcState({
          isProcessing: false,
          stepMessage: '',
          progressPercent: 0,
          error: pdfPassword
            ? 'Incorrect password entered. Please enter the valid password for this PDF.'
            : 'This PDF is password protected. Please enter the password below to continue.',
        });
        return;
      }

      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error:
          err.message ||
          'This PDF could not be compressed. The file may be corrupted, password protected or unsupported.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPageCount(0);
    setResult(null);
    setIsPasswordRequired(false);
    setPdfPassword('');
    setCustomFileName('');
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  const getLevelBadge = () => {
    if (compressionSlider >= 85) {
      return {
        title: 'Maximum Compression',
        desc: 'Smallest file size. Ideal for strict email limits (text stays crisp, images optimized).',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
      };
    }
    if (compressionSlider >= 60) {
      return {
        title: 'Strong Compression (Recommended)',
        desc: 'Significant size reduction while maintaining high document readability.',
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      };
    }
    if (compressionSlider >= 35) {
      return {
        title: 'Balanced Compression',
        desc: 'Good size reduction with excellent visual clarity.',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
      };
    }
    return {
      title: 'Light Compression (High Quality)',
      desc: 'Minimal size reduction with near-original image quality.',
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    };
  };

  const currentLevel = getLevelBadge();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdSlot position="pdf-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          PDF Compressor
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Reduce PDF file size for fast uploads and email sharing while keeping text perfectly crisp and readable.
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
            title="Upload PDF to Compress"
            subtitle="Drop your PDF document here (Supports all standard, scanned & password-protected PDFs)"
            selectedFiles={selectedFile ? [selectedFile] : []}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFile && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              {/* File Info Bar */}
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
                      Original Size: <span className="font-bold text-slate-700">{formatBytes(selectedFile.size)}</span>
                      {pageCount > 0 ? ` • ${pageCount} Pages` : ''}
                    </p>
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${currentLevel.color}`}>
                  {currentLevel.title}
                </div>
              </div>

              {/* Password Protection Prompt */}
              {isPasswordRequired && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5 text-amber-900 text-xs sm:text-sm">
                    <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">This PDF is password protected.</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Please enter the document password to unlock and continue compression.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 max-w-md">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Key className="w-4 h-4" />
                      </div>
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={pdfPassword}
                        onChange={(e) => setPdfPassword(e.target.value)}
                        placeholder="Enter PDF password..."
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && pdfPassword.trim()) {
                            handleCompress();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCompress}
                      disabled={!pdfPassword.trim() || procState.isProcessing}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      Unlock & Compress
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic Size ↔ Quality Slider */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Size ↔ Quality Compression Level
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    Compression Level: {compressionSlider}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={compressionSlider}
                    onChange={(e) => setCompressionSlider(parseInt(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span className="text-slate-700">Better Quality (Larger File)</span>
                    <span className="text-indigo-600 font-bold">Balanced (Recommended)</span>
                    <span className="text-slate-700">Smaller File (Max Compression)</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {currentLevel.desc}
                </p>

                {/* Expected Output Size Highlight */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-slate-700 font-medium">Estimated Output Size:</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-600">
                    {estSize.label}
                  </span>
                </div>
              </div>

              {/* Output File Name Customization */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  Output File Name (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="MyDocument_compressed"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 px-2 py-2 bg-slate-200/60 rounded-xl">
                    .pdf
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Leave blank to automatically name as <code className="text-indigo-600 font-mono">document_compressed.pdf</code>.
                </p>
              </div>

              {/* Progress Indicator */}
              <ProgressBar
                isProcessing={procState.isProcessing}
                stepMessage={procState.stepMessage}
                progressPercent={procState.progressPercent}
              />

              {/* Error Message with Specific Reason */}
              {procState.error && !isPasswordRequired && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5 text-rose-800 text-xs sm:text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Compression Failed</p>
                      <p className="text-xs text-rose-700 mt-0.5">{procState.error}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompress}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleCompress}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Compressing PDF Document...
                  </>
                ) : (
                  <>
                    Compress PDF File
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
