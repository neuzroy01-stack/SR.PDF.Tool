import React, { useState } from 'react';
import { ImageFormat, ConversionResult, ProcessingState } from '../types';
import { convertImageFormat, formatBytes } from '../services/imageService';
import { createAndDownloadZip } from '../services/zipService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import { ArrowRight, Sliders, RefreshCw, Layers } from 'lucide-react';

interface ImageConverterToolProps {
  onOpenAdmin?: () => void;
}

export const ImageConverterTool: React.FC<ImageConverterToolProps> = ({ onOpenAdmin }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFormat, setTargetFormat] = useState<ImageFormat>('png');
  const [quality, setQuality] = useState<number>(0.92);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });

    // Auto-detect smart target format
    if (files.length > 0) {
      const ext = files[0].name.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') setTargetFormat('png');
      else if (ext === 'png') setTargetFormat('jpeg');
      else if (ext === 'webp') setTargetFormat('png');
      else if (ext === 'bmp') setTargetFormat('png');
    }
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Reading and decoding image data...',
      progressPercent: 15,
      error: null,
    });

    try {
      if (selectedFiles.length === 1) {
        // Single File
        const file = selectedFiles[0];
        setProcState((prev) => ({ ...prev, stepMessage: 'Processing image conversion...', progressPercent: 45 }));

        const res = await convertImageFormat(file, targetFormat, quality, { grayscale });
        
        setProcState((prev) => ({ ...prev, stepMessage: 'Finalizing converted file...', progressPercent: 90 }));

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
        const outName = `${baseName}.${ext}`;
        const previewUrl = URL.createObjectURL(res.blob);

        const ratio = Math.max(0, Math.round(((file.size - res.blob.size) / file.size) * 1000) / 10);

        setResult({
          blob: res.blob,
          url: previewUrl,
          filename: outName,
          originalSize: file.size,
          finalSize: res.blob.size,
          format: targetFormat.toUpperCase(),
          compressionRatio: ratio,
          width: res.width,
          height: res.height,
          previewUrl,
        });
      } else {
        // Batch Multi-File conversion
        const convertedFiles: { name: string; blob: Blob }[] = [];
        let totalOrigSize = 0;
        let totalFinalSize = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          totalOrigSize += file.size;
          const pct = Math.round(20 + (i / selectedFiles.length) * 65);
          setProcState({
            isProcessing: true,
            stepMessage: `Converting ${file.name} (${i + 1}/${selectedFiles.length})...`,
            progressPercent: pct,
            error: null,
          });

          const res = await convertImageFormat(file, targetFormat, quality, { grayscale });
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
          convertedFiles.push({ name: `${baseName}.${ext}`, blob: res.blob });
          totalFinalSize += res.blob.size;
        }

        setProcState({
          isProcessing: true,
          stepMessage: 'Archiving files into ZIP...',
          progressPercent: 90,
          error: null,
        });

        const zipBlob = await createAndDownloadZip(convertedFiles, `converted_images_${targetFormat}.zip`);
        const ratio = Math.max(0, Math.round(((totalOrigSize - totalFinalSize) / totalOrigSize) * 1000) / 10);

        setResult({
          blob: zipBlob,
          url: URL.createObjectURL(zipBlob),
          filename: `converted_images_${targetFormat}.zip`,
          originalSize: totalOrigSize,
          finalSize: zipBlob.size,
          format: `ZIP (${targetFormat.toUpperCase()})`,
          compressionRatio: ratio,
        });
      }

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('Image conversion error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Conversion failed. Please verify file integrity.',
      });
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Top Ad */}
      <AdSlot position="image-tools" onOpenAdmin={onOpenAdmin} />

      {/* Header */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Image Converter
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Convert JPG, PNG, WEBP, and BMP instantly in your browser with maximum clarity and aspect-ratio preservation.
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
            accept="image/jpeg,image/png,image/webp,image/bmp,image/*"
            multiple={true}
            title="Upload Images to Convert"
            subtitle="Drop JPG, PNG, WEBP or BMP images here"
            selectedFiles={selectedFiles}
            onFilesSelected={handleFilesSelected}
            onClear={handleReset}
          />

          {selectedFiles.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Conversion Settings</h3>
              </div>

              {/* Target Format Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Target Output Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['png', 'jpeg', 'webp', 'bmp'] as ImageFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setTargetFormat(fmt)}
                      className={`p-3.5 rounded-2xl border text-center font-bold text-sm transition-all ${
                        targetFormat === fmt
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <span className="uppercase">{fmt === 'jpeg' ? 'JPG' : fmt}</span>
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                        {fmt === 'png' ? 'Lossless / Alpha' : fmt === 'jpeg' ? 'Standard Photo' : fmt === 'webp' ? 'Modern Web' : 'Bitmap'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Slider (for JPEG / WEBP) */}
              {(targetFormat === 'jpeg' || targetFormat === 'webp') && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                    <span>OUTPUT QUALITY</span>
                    <span className="font-mono text-indigo-600 font-bold">{Math.round(quality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={quality}
                    onChange={(e) => setQuality(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Smaller File (Low)</span>
                    <span>Balanced (80%)</span>
                    <span>Best Quality (100%)</span>
                  </div>
                </div>
              )}

              {/* Grayscale switch */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Black & White / Grayscale</h4>
                  <p className="text-[11px] text-slate-500">Convert color images to clean monochrome</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={grayscale}
                    onChange={(e) => setGrayscale(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
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

              {/* Convert Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleConvert}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    Convert {selectedFiles.length} {selectedFiles.length === 1 ? 'Image' : 'Images'} to {targetFormat.toUpperCase()}
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
