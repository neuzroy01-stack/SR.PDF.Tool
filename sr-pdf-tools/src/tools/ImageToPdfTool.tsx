import React, { useState, useRef } from 'react';
import {
  ImageFileItem,
  PdfPageSize,
  PdfOrientation,
  PdfMargin,
  ConversionResult,
  ProcessingState,
} from '../types';
import { imagesToPdf } from '../services/pdfService';
import { formatBytes } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import { CameraCaptureModal } from '../components/CameraCaptureModal';
import { ImageCropModal } from '../components/ImageCropModal';
import {
  FileText,
  RotateCw,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  Sliders,
  ArrowRight,
  RefreshCw,
  Plus,
  Camera,
  Crop as CropIcon,
  Layers,
  Check,
} from 'lucide-react';

interface ImageToPdfToolProps {
  onOpenAdmin?: () => void;
}

export const ImageToPdfTool: React.FC<ImageToPdfToolProps> = ({ onOpenAdmin }) => {
  const [imageItems, setImageItems] = useState<ImageFileItem[]>([]);
  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [orientation, setOrientation] = useState<PdfOrientation>('portrait');
  const [margin, setMargin] = useState<PdfMargin>('normal');
  const [documentScanAll, setDocumentScanAll] = useState<boolean>(false);
  const [grayscaleAll, setGrayscaleAll] = useState<boolean>(false);

  // Quality & Target Size Slider: 0 (Min Size) to 100 (Max Quality)
  const [qualitySlider, setQualitySlider] = useState<number>(80); // default 80% high quality
  const [customFileName, setCustomFileName] = useState<string>('document_compiled');

  // Modals
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cropItemIndex, setCropItemIndex] = useState<number | null>(null);

  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFilesSelected = (_files: File[], items?: ImageFileItem[]) => {
    if (items && items.length > 0) {
      setImageItems((prev) => [...prev, ...items]);
    }
  };

  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);
    const newItems: ImageFileItem[] = fileList.map((f: File) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      previewUrl: URL.createObjectURL(f),
      rotation: 0,
    }));

    setImageItems((prev) => [...prev, ...newItems]);
    if (additionalFileInputRef.current) {
      additionalFileInputRef.current.value = '';
    }
  };

  const handleCameraPhoto = (file: File) => {
    const newItem: ImageFileItem = {
      id: `camera-${Date.now()}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
    };
    setImageItems((prev) => [...prev, newItem]);
  };

  const handleCameraBatch = (files: File[]) => {
    const newItems: ImageFileItem[] = files.map((file, idx) => ({
      id: `camera-batch-${Date.now()}-${idx}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
      rotation: 0,
    }));
    setImageItems((prev) => [...prev, ...newItems]);
  };

  const handleRotateItem = (id: string) => {
    setImageItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, rotation: ((item.rotation || 0) + 90) % 360 } : item
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    setImageItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const items = [...imageItems];
      const temp = items[index - 1];
      items[index - 1] = items[index];
      items[index] = temp;
      setImageItems(items);
    } else if (direction === 'down' && index < imageItems.length - 1) {
      const items = [...imageItems];
      const temp = items[index + 1];
      items[index + 1] = items[index];
      items[index] = temp;
      setImageItems(items);
    }
  };

  const handleApplyCropped = (croppedFile: File, croppedUrl: string) => {
    if (cropItemIndex !== null && cropItemIndex >= 0 && cropItemIndex < imageItems.length) {
      setImageItems((prev) =>
        prev.map((item, idx) =>
          idx === cropItemIndex
            ? {
                ...item,
                file: croppedFile,
                name: croppedFile.name,
                size: croppedFile.size,
                previewUrl: croppedUrl,
              }
            : item
        )
      );
    }
    setCropItemIndex(null);
  };

  // Dynamic estimated size calculation
  const totalImageBytes = imageItems.reduce((acc, item) => acc + item.size, 0);
  const qRatio = qualitySlider / 100;
  const estMinBytes = Math.max(30 * 1024, Math.round(totalImageBytes * 0.18 * Math.max(0.4, qRatio)));
  const estMaxBytes = Math.max(estMinBytes + 20 * 1024, Math.round(totalImageBytes * 0.75 * Math.max(0.6, qRatio)));

  const handleGeneratePdf = async () => {
    if (imageItems.length === 0) return;

    setProcState({
      isProcessing: true,
      stepMessage: 'Assembling high-quality document layout...',
      progressPercent: 10,
      error: null,
    });

    try {
      const pdfBlob = await imagesToPdf(
        imageItems,
        {
          pageSize,
          orientation,
          margin,
          documentScanAll,
          grayscaleAll,
          qualityLevel: qualitySlider,
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

      const previewUrl = URL.createObjectURL(pdfBlob);
      const cleanBase = customFileName.trim() || `document_${imageItems.length}_pages`;
      const filename = cleanBase.endsWith('.pdf') ? cleanBase : `${cleanBase}.pdf`;
      const ratio = Math.max(0, Math.round(((totalImageBytes - pdfBlob.size) / totalImageBytes) * 1000) / 10);

      setResult({
        blob: pdfBlob,
        url: previewUrl,
        filename,
        originalSize: totalImageBytes,
        finalSize: pdfBlob.size,
        format: 'PDF Document',
        compressionRatio: ratio,
        pageCount: imageItems.length,
      });

      setProcState({ isProcessing: false, stepMessage: 'Complete', progressPercent: 100, error: null });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to generate PDF document.',
      });
    }
  };

  const handleReset = () => {
    setImageItems([]);
    setResult(null);
    setProcState({ isProcessing: false, stepMessage: '', progressPercent: 0, error: null });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <AdSlot position="pdf-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Images to PDF Converter
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Convert single or multiple photos into one clean PDF document with drag & drop reordering, in-place crop, rotation, and custom target size.
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
            accept="image/*,image/jpeg,image/png,image/webp,image/bmp"
            multiple={true}
            title="Upload Images or Photos"
            subtitle="Select one or multiple photos to convert into a single PDF"
            onFilesSelected={handleFilesSelected}
            onOpenLiveCamera={() => setIsCameraOpen(true)}
          />

          {imageItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in duration-200">
              
              {/* Header Bar with Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Document Pages ({imageItems.length} {imageItems.length === 1 ? 'Page' : 'Pages'})
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Total: {formatBytes(totalImageBytes)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Add More Photos */}
                  <button
                    type="button"
                    onClick={() => additionalFileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    Add Images
                  </button>
                  <input
                    ref={additionalFileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleAddMoreFiles}
                    className="hidden"
                  />

                  {/* Camera capture */}
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Take Photo
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer ml-2"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Pages Grid with Crop, Rotate, Reorder & Delete */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col space-y-3 relative group"
                  >
                    {/* Header badge */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs">
                        Page {index + 1}
                      </span>
                      <span className="text-[11px] font-mono truncate max-w-[120px]">
                        {formatBytes(item.size)}
                      </span>
                    </div>

                    {/* Image Preview Container */}
                    <div className="h-44 rounded-xl bg-white overflow-hidden flex items-center justify-center p-2 border border-slate-200 shadow-inner">
                      <img
                        src={item.previewUrl}
                        alt={`Page ${index + 1}`}
                        style={{ transform: `rotate(${item.rotation || 0}deg)` }}
                        className="max-h-full max-w-full object-contain rounded transition-transform duration-200"
                      />
                    </div>

                    {/* Item Controls: Reorder, Crop, Rotate, Delete */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 shadow-xs cursor-pointer"
                          title="Move Page Up"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === imageItems.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 shadow-xs cursor-pointer"
                          title="Move Page Down"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCropItemIndex(index)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-indigo-600 flex items-center gap-1 shadow-xs cursor-pointer font-medium"
                          title="Crop Image"
                        >
                          <CropIcon className="w-3.5 h-3.5" />
                          <span>Crop</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateItem(item.id)}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 flex items-center gap-1 shadow-xs cursor-pointer"
                          title="Rotate Page 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>{item.rotation ? `${item.rotation}°` : '0°'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 shadow-xs cursor-pointer"
                        title="Delete Page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Target File Size / Quality Slider */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    PDF Target Size & Image Quality Slider
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    Quality Level: {qualitySlider}%
                  </span>
                </div>

                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="15"
                    max="100"
                    step="5"
                    value={qualitySlider}
                    onChange={(e) => setQualitySlider(parseInt(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Smaller File (Minimum Size)</span>
                    <span className="text-indigo-600">Balanced (Recommended)</span>
                    <span>Crisp / Better Quality (Larger)</span>
                  </div>
                </div>

                {/* Estimated Output Size Highlight */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-slate-700 font-medium">Estimated PDF Size:</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-600">
                    ~{formatBytes(estMinBytes)} – {formatBytes(estMaxBytes)}
                  </span>
                </div>
              </div>

              {/* PDF Document Formatting Settings */}
              <div className="pt-2 border-t border-slate-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Page Size */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Page Size:
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(e.target.value as PdfPageSize)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="a4">A4 (Standard 210 × 297 mm)</option>
                      <option value="letter">US Letter (8.5 × 11 in)</option>
                      <option value="a5">A5 (148 × 210 mm)</option>
                      <option value="original">Original Image Dimensions</option>
                    </select>
                  </div>

                  {/* Orientation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Orientation:
                    </label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value as PdfOrientation)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="portrait">Portrait (Vertical)</option>
                      <option value="landscape">Landscape (Horizontal)</option>
                      <option value="auto">Auto-Detect per Image</option>
                    </select>
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Page Margins:
                    </label>
                    <select
                      value={margin}
                      onChange={(e) => setMargin(e.target.value as PdfMargin)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="none">No Margin (Edge-to-Edge)</option>
                      <option value="small">Small (0.25 in)</option>
                      <option value="normal">Normal (0.5 in)</option>
                      <option value="large">Large (0.75 in)</option>
                    </select>
                  </div>
                </div>

                {/* Scan Enhance Option */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">Document Scan / Paper Cleaner</h5>
                        <p className="text-[11px] text-slate-600">
                          Whitens background and deepens text ink for scanned papers and notes.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={documentScanAll}
                        onChange={(e) => setDocumentScanAll(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {documentScanAll && (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-700">Convert to Black & White (Grayscale)</span>
                      <input
                        type="checkbox"
                        checked={grayscaleAll}
                        onChange={(e) => setGrayscaleAll(e.target.checked)}
                        className="rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Output File Name Customization */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  Output File Name (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="document_compiled"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 px-2.5 py-2 bg-slate-200/60 rounded-xl">
                    .pdf
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Leave blank to automatically name as <code className="text-indigo-600 font-mono">document_{imageItems.length}_pages.pdf</code>.
                </p>
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

              {/* Generate Action Button */}
              <button
                type="button"
                disabled={procState.isProcessing}
                onClick={handleGeneratePdf}
                className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {procState.isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generating PDF Document...
                  </>
                ) : (
                  <>
                    Create PDF ({imageItems.length} {imageItems.length === 1 ? 'Page' : 'Pages'})
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureSingle={handleCameraPhoto}
        onCaptureBatch={handleCameraBatch}
      />

      {/* Image Cropping Modal */}
      {cropItemIndex !== null && imageItems[cropItemIndex] && (
        <ImageCropModal
          isOpen={true}
          imageSrc={imageItems[cropItemIndex].previewUrl}
          imageName={imageItems[cropItemIndex].name}
          onClose={() => setCropItemIndex(null)}
          onApplyCrop={handleApplyCropped}
        />
      )}
    </div>
  );
};
