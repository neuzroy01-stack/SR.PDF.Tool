import React, { useState } from 'react';
import { ConversionResult, ProcessingState } from '../types';
import {
  compressImageToTargetSize,
  formatBytes,
  parseSizeInputToBytes,
  getImageDimensions,
} from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import { Zap, Sliders, CheckCircle2, ArrowRight, RefreshCw, Eye } from 'lucide-react';

interface ImageCompressorToolProps {
  onOpenAdmin?: () => void;
}

const PRESET_SIZES = [
  { label: '20 KB', bytes: 20 * 1024, desc: 'Ultra Compact' },
  { label: '50 KB', bytes: 50 * 1024, desc: 'Web Form Standard' },
  { label: '100 KB', bytes: 100 * 1024, desc: 'Email / Portal' },
  { label: '150 KB', bytes: 150 * 1024, desc: 'Fast Loading' },
  { label: '200 KB', bytes: 200 * 1024, desc: 'Passport / ID' },
  { label: '500 KB', bytes: 500 * 1024, desc: 'High Quality Web' },
  { label: '1 MB', bytes: 1024 * 1024, desc: 'Photography' },
  { label: '2 MB', bytes: 2 * 1024 * 1024, desc: 'Print / High-Res' },
];

export const ImageCompressorTool: React.FC<ImageCompressorToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPresetBytes, setSelectedPresetBytes] = useState<number>(200 * 1024); // default 200KB
  const [customInput, setCustomInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);

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

    const prevUrl = URL.createObjectURL(file);
    setOriginalPreviewUrl(prevUrl);

    try {
      const dims = await getImageDimensions(file);
      setOriginalDimensions(dims);
    } catch {
      // Ignore
    }
  };

  const getActiveTargetBytes = (): number => {
    if (isCustomMode && customInput.trim()) {
      const parsed = parseSizeInputToBytes(customInput);
      if (parsed) return parsed;
    }
    return selectedPresetBytes;
  };

  const handleCompress = async () => {
    if (!selectedFile) return;

    const targetBytes = getActiveTargetBytes();
    if (!targetBytes || targetBytes <= 0) {
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: 'Please enter a valid target size (e.g. 75 KB, 1.5 MB).',
      });
      return;
    }

    setProcState({
      isProcessing: true,
      stepMessage: 'Analyzing image data & histogram...',
      progressPercent: 10,
      error: null,
    });

    try {
      const compressed = await compressImageToTargetSize(
        selectedFile,
        targetBytes,
        (msg, pct) => {
          setProcState({
            isProcessing: true,
            stepMessage: msg,
            progressPercent: pct,
            error: null,
          });
        }
      );

      const previewUrl = URL.createObjectURL(compressed.blob);
      const ratio = Math.max(0, Math.round(((selectedFile.size - compressed.finalSize) / selectedFile.size) * 1000) / 10);
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const outName = `${baseName}_compressed.jpg`;

      setResult({
        blob: compressed.blob,
        url: previewUrl,
        filename: outName,
        originalSize: selectedFile.size,
        finalSize: compressed.finalSize,
        format: 'JPG (Optimized)',
        compressionRatio: ratio,
        width: compressed.width,
        height: compressed.height,
        previewUrl,
      });

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('Compression error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Image compression failed.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
    setOriginalPreviewUrl(null);
    setOriginalDimensions(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  const targetBytes = getActiveTargetBytes();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Top Ad */}
      <AdSlot position="image-tools" onOpenAdmin={onOpenAdmin} />

      {/* Header */}
      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-1">
          <Zap className="w-3.5 h-3.5 text-indigo-600" />
          Binary Search Precision Engine
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Compress Image to Target Size
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Specify your exact target file size (e.g. 50 KB, 200 KB, 1.5 MB). Our smart optimizer automatically finds the highest visual quality.
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
            accept="image/*,image/jpeg,image/png,image/webp"
            multiple={false}
            title="Upload Image to Compress"
            subtitle="Drop a JPG, PNG, or WEBP photo"
            selectedFiles={selectedFile ? [selectedFile] : []}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFile && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              {/* File Info Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Source Image
                  </span>
                  <p className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                    {selectedFile.name}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Current Size:</span>{' '}
                    <span className="font-mono font-bold text-slate-900">
                      {formatBytes(selectedFile.size)}
                    </span>
                  </div>
                  {originalDimensions && (
                    <div>
                      <span className="text-slate-500">Dimensions:</span>{' '}
                      <span className="font-mono font-bold text-slate-900">
                        {originalDimensions.width} × {originalDimensions.height} px
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Target Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Select Target File Size
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    Target: {formatBytes(targetBytes)}
                  </span>
                </div>

                {/* Preset grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {PRESET_SIZES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSelectedPresetBytes(preset.bytes);
                        setIsCustomMode(false);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        !isCustomMode && selectedPresetBytes === preset.bytes
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm">{preset.label}</div>
                      <div className="text-[10px] opacity-75">{preset.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Custom Size Input */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Or Enter Custom Target (e.g. 75 KB, 1.5 MB):
                    </label>
                    {isCustomMode && (
                      <span className="text-[10px] text-indigo-600 font-semibold">
                        Custom mode active
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 75 KB or 1.5 MB"
                      value={customInput}
                      onChange={(e) => {
                        setCustomInput(e.target.value);
                        setIsCustomMode(true);
                      }}
                      onFocus={() => setIsCustomMode(true)}
                      className="flex-1 text-sm bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customInput.trim()) {
                          setIsCustomMode(true);
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
                    >
                      Apply Target
                    </button>
                  </div>
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
                onClick={handleCompress}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Optimizing Quality & Dimensions...
                  </>
                ) : (
                  <>
                    Compress to ~{formatBytes(targetBytes)}
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
