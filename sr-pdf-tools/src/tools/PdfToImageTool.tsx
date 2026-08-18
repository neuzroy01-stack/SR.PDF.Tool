import React, { useState } from 'react';
import { ProcessingState } from '../types';
import { pdfToImages, getPdfDetails } from '../services/pdfService';
import { createZipArchive, triggerDownload } from '../services/zipService';
import { formatBytes } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { AdSlot } from '../components/AdSlot';
import {
  FileText,
  Download,
  Layers,
  ArrowRight,
  RefreshCw,
  Archive,
  CheckCircle2,
  Sliders,
  CheckSquare,
  Square,
  RotateCcw,
  Lock,
  Key,
  Eye,
  EyeOff,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PdfToImageToolProps {
  onOpenAdmin?: () => void;
}

interface ExtractedImage {
  pageNumber: number;
  blob: Blob;
  filename: string;
  previewUrl: string;
  width: number;
  height: number;
}

export const PdfToImageTool: React.FC<PdfToImageToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [dpi, setDpi] = useState<number>(150); // 72, 150, 300
  
  // Selection mode: 'all' or 'custom'
  const [extractMode, setExtractMode] = useState<'all' | 'custom'>('all');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  // Password Protection
  const [isPasswordRequired, setIsPasswordRequired] = useState<boolean>(false);
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);

  // Custom Output Naming
  const [customZipName, setCustomZipName] = useState<string>('');

  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setExtractedImages([]);
    setIsPasswordRequired(false);
    setPdfPassword('');
    
    const baseClean = file.name.replace(/\.[^/.]+$/, '');
    setCustomZipName(`${baseClean}_images`);

    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });

    try {
      const details = await getPdfDetails(file);
      setPageCount(details.pageCount);
      // Select all by default
      setSelectedPages(Array.from({ length: details.pageCount }, (_, i) => i + 1));
    } catch (err: any) {
      console.warn('PDF details read note:', err);
      if (err.isPasswordProtected) {
        setIsPasswordRequired(true);
      }
    }
  };

  const togglePageSelection = (pageNum: number) => {
    setSelectedPages((prev) =>
      prev.includes(pageNum) ? prev.filter((p) => p !== pageNum) : [...prev, pageNum].sort((a, b) => a - b)
    );
  };

  const handleSelectAllPages = () => {
    setSelectedPages(Array.from({ length: pageCount }, (_, i) => i + 1));
  };

  const handleDeselectAllPages = () => {
    setSelectedPages([]);
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    const pagesToExtract = extractMode === 'all' ? undefined : selectedPages;
    if (extractMode === 'custom' && selectedPages.length === 0) {
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: 'Please select at least one page to extract.',
      });
      return;
    }

    setProcState({
      isProcessing: true,
      stepMessage: 'Rendering PDF pages into high-resolution images...',
      progressPercent: 10,
      error: null,
    });

    try {
      const results = await pdfToImages(
        selectedFile,
        {
          format,
          dpi,
          selectedPages: pagesToExtract,
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

      setExtractedImages(results);
      setProcState({ isProcessing: false, stepMessage: 'Extraction Complete', progressPercent: 100, error: null });
      setIsPasswordRequired(false);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('PDF to Image conversion error:', err);
      if (err.isPasswordProtected) {
        setIsPasswordRequired(true);
        setProcState({
          isProcessing: false,
          stepMessage: '',
          progressPercent: 0,
          error: pdfPassword
            ? 'Incorrect password. Please enter the valid password to extract images.'
            : 'This PDF is password protected. Please enter the password below.',
        });
        return;
      }

      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to extract images from PDF. The file may be corrupted or protected.',
      });
    }
  };

  const handleDownloadSingle = (image: ExtractedImage) => {
    triggerDownload(image.blob, image.filename);
  };

  const handleDownloadAllZip = async () => {
    if (extractedImages.length === 0) return;
    setIsZipping(true);
    try {
      const filesToZip = extractedImages.map((img) => ({
        name: img.filename,
        blob: img.blob,
      }));
      const baseClean = customZipName.trim() || selectedFile?.name.replace(/\.[^/.]+$/, '') + '_images' || 'pdf_pages';
      const zipFileName = baseClean.endsWith('.zip') ? baseClean : `${baseClean}.zip`;

      const zipBlob = await createZipArchive(filesToZip);
      triggerDownload(zipBlob, zipFileName);
    } catch (err) {
      console.error('Zip creation error:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPageCount(0);
    setExtractedImages([]);
    setSelectedPages([]);
    setIsPasswordRequired(false);
    setPdfPassword('');
    setCustomZipName('');
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdSlot position="pdf-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          PDF to JPG & PNG Converter
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Extract every page or selected pages of any PDF document into crystal-clear JPG or PNG images with one-click ZIP download.
        </p>
      </div>

      {extractedImages.length > 0 ? (
        /* Results View */
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
          
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Extracted {extractedImages.length} {extractedImages.length === 1 ? 'Image' : 'Images'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Format: {format.toUpperCase()} • Resolution: {dpi} DPI
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Convert Another
              </button>

              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isZipping}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {isZipping ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Packaging ZIP...
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    Download All as ZIP
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Customizable ZIP Name Bar */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              <span>Output ZIP Name:</span>
            </div>
            <div className="flex-1 max-w-md flex items-center gap-2">
              <input
                type="text"
                value={customZipName}
                onChange={(e) => setCustomZipName(e.target.value)}
                placeholder="extracted_pages"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-xs font-mono font-bold text-slate-400">.zip</span>
            </div>
          </div>

          {/* Image Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {extractedImages.map((img) => (
              <div
                key={img.pageNumber}
                className="group relative bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                {/* Preview Thumbnail */}
                <div className="relative aspect-[3/4] bg-slate-200/60 overflow-hidden flex items-center justify-center p-2">
                  <img
                    src={img.previewUrl}
                    alt={`Page ${img.pageNumber}`}
                    className="w-full h-full object-contain drop-shadow-xs"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/80 text-white text-[10px] font-mono font-bold backdrop-blur-xs">
                    Page {img.pageNumber}
                  </div>
                </div>

                {/* Footer Info & Single Download */}
                <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <p className="text-xs font-mono font-bold text-slate-800 truncate">
                      {img.filename}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {formatBytes(img.blob.size)} • {img.width}×{img.height}px
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadSingle(img)}
                    className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Download this page image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ad slot before exit */}
          <AdSlot position="before-download" onOpenAdmin={onOpenAdmin} />
        </div>
      ) : (
        /* Upload & Configuration Form */
        <div className="space-y-6">
          <FileUploader
            accept=".pdf,application/pdf"
            multiple={false}
            title="Upload PDF Document"
            subtitle="Select a PDF to extract pages as high-quality JPG or PNG images"
            selectedFiles={selectedFile ? [selectedFile] : []}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFile && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              {/* Document Overview */}
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
                      {formatBytes(selectedFile.size)} {pageCount > 0 ? `• ${pageCount} Total Pages` : ''}
                    </p>
                  </div>
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
                        Please enter the document password to unlock and extract images.
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
                        className="w-full pl-9 pr-10 py-2.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && pdfPassword.trim()) {
                            handleExtract();
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
                      onClick={handleExtract}
                      disabled={!pdfPassword.trim() || procState.isProcessing}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      Unlock & Extract
                    </button>
                  </div>
                </div>
              )}

              {/* Conversion Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Format selector */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Output Image Format:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormat('jpeg')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        format === 'jpeg'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      JPG (Recommended)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('png')}
                      className={`p-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        format === 'png'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      PNG (Lossless)
                    </button>
                  </div>
                </div>

                {/* Resolution / DPI selector */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Image Resolution (DPI):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 72, label: '72 DPI', desc: 'Screen' },
                      { val: 150, label: '150 DPI', desc: 'Standard' },
                      { val: 300, label: '300 DPI', desc: 'HD Print' },
                    ].map((d) => (
                      <button
                        key={d.val}
                        type="button"
                        onClick={() => setDpi(d.val)}
                        className={`p-2 rounded-xl text-xs font-bold transition-colors flex flex-col items-center cursor-pointer ${
                          dpi === d.val
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{d.label}</span>
                        <span
                          className={`text-[9px] font-normal ${
                            dpi === d.val ? 'text-indigo-200' : 'text-slate-400'
                          }`}
                        >
                          {d.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Page Selection Options (if page count known) */}
              {pageCount > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pages to Extract:
                    </label>

                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setExtractMode('all')}
                        className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          extractMode === 'all'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        All Pages ({pageCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setExtractMode('custom')}
                        className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          extractMode === 'custom'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Select Specific Pages ({selectedPages.length})
                      </button>
                    </div>
                  </div>

                  {/* Interactive Page Matrix */}
                  {extractMode === 'custom' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                        <span>Click page numbers to toggle selection:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllPages}
                            className="text-indigo-600 font-semibold hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={handleDeselectAllPages}
                            className="text-slate-600 hover:underline cursor-pointer"
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map((pNum) => {
                          const isSelected = selectedPages.includes(pNum);
                          return (
                            <button
                              key={pNum}
                              type="button"
                              onClick={() => togglePageSelection(pNum)}
                              className={`w-9 h-9 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-xs scale-105'
                                  : 'bg-white border border-slate-300 text-slate-600 hover:border-slate-400'
                              }`}
                            >
                              {pNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Output ZIP Name */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-indigo-600" />
                  Output ZIP File Name (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customZipName}
                    onChange={(e) => setCustomZipName(e.target.value)}
                    placeholder="extracted_pages"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 px-2.5 py-2 bg-slate-200/60 rounded-xl">
                    .zip
                  </span>
                </div>
              </div>

              <ProgressBar
                isProcessing={procState.isProcessing}
                stepMessage={procState.stepMessage}
                progressPercent={procState.progressPercent}
              />

              {procState.error && !isPasswordRequired && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {procState.error}
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleExtract}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Extracting Pages to Images...
                  </>
                ) : (
                  <>
                    Convert PDF to Images
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
