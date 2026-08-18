import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ConversionResult, ImageFormat, ProcessingState } from '../types';
import { loadImage, convertImageFormat, formatBytes, canvasToBmpBlob, compressImageToTargetSize } from '../services/imageService';
import { FileUploader } from '../components/FileUploader';
import { DownloadResult } from '../components/DownloadResult';
import { AdSlot } from '../components/AdSlot';
import {
  Crop,
  Maximize2,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Type,
  Pencil,
  Undo2,
  Redo2,
  RotateCcw as ResetIcon,
  Download,
  Check,
  X,
  Palette,
  Sparkles,
  Zap,
} from 'lucide-react';

interface ImageEditorToolProps {
  onOpenAdmin?: () => void;
}

interface EditorState {
  // Canvas image data as snapshot
  imageData: ImageData;
  width: number;
  height: number;
}

export const ImageEditorTool: React.FC<ImageEditorToolProps> = ({ onOpenAdmin }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'adjust' | 'crop' | 'resize' | 'rotate' | 'draw' | 'text' | 'export'>('adjust');

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // History for Undo / Redo
  const [history, setHistory] = useState<EditorState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Adjustments state
  const [brightness, setBrightness] = useState<number>(100); // 0-200, normal 100
  const [contrast, setContrast] = useState<number>(100); // 0-200
  const [saturation, setSaturation] = useState<number>(100); // 0-200
  const [blur, setBlur] = useState<number>(0); // 0-20px
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [sepia, setSepia] = useState<boolean>(false);
  const [invert, setInvert] = useState<boolean>(false);

  // Resize state
  const [resizeWidth, setResizeWidth] = useState<number>(800);
  const [resizeHeight, setResizeHeight] = useState<number>(600);
  const [lockAspect, setLockAspect] = useState<boolean>(true);

  // Crop state
  const [cropAspect, setCropAspect] = useState<'free' | '1:1' | '4:3' | '16:9'>('free');
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 200, height: 200 });

  // Drawing state
  const [brushColor, setBrushColor] = useState<string>('#6366f1');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Text state
  const [textInput, setTextInput] = useState<string>('Sample Text');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(32);
  const [textX, setTextX] = useState<number>(50);
  const [textY, setTextY] = useState<number>(80);

  // Export settings
  const [exportFormat, setExportFormat] = useState<ImageFormat>('png');
  const [exportQuality, setExportQuality] = useState<number>(0.92);
  const [targetCompressKB, setTargetCompressKB] = useState<string>('');

  const [result, setResult] = useState<ConversionResult | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load image onto canvas
  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setResult(null);

    const img = await loadImage(file);
    originalImageRef.current = img;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    setResizeWidth(w);
    setResizeHeight(h);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const initialImageData = ctx.getImageData(0, 0, w, h);
        setHistory([{ imageData: initialImageData, width: w, height: h }]);
        setHistoryIndex(0);
      }
    }
  };

  const pushState = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const state: EditorState = {
      imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
      width: canvas.width,
      height: canvas.height,
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    // limit history depth to 15
    if (newHistory.length > 15) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const state = history[prevIdx];
      setHistoryIndex(prevIdx);
      applyStateToCanvas(state);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const state = history[nextIdx];
      setHistoryIndex(nextIdx);
      applyStateToCanvas(state);
    }
  };

  const applyStateToCanvas = (state: EditorState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = state.width;
    canvas.height = state.height;
    setResizeWidth(state.width);
    setResizeHeight(state.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.putImageData(state.imageData, 0, 0);
    }
  };

  const handleResetToOriginal = () => {
    if (!originalImageRef.current || !canvasRef.current) return;
    const img = originalImageRef.current;
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    setResizeWidth(canvas.width);
    setResizeHeight(canvas.height);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      pushState(canvas);
    }

    // Reset sliders
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
    setGrayscale(false);
    setSepia(false);
    setInvert(false);
  };

  // Re-render adjustments preview using canvas filter
  const applyFilterAdjustments = () => {
    if (!canvasRef.current || historyIndex < 0) return;
    const canvas = canvasRef.current;
    const baseState = history[historyIndex];
    if (!baseState) return;

    // Create temporary offscreen canvas with current state
    const offCanvas = document.createElement('canvas');
    offCanvas.width = baseState.width;
    offCanvas.height = baseState.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;
    offCtx.putImageData(baseState.imageData, 0, 0);

    // Apply CSS filters on master canvas
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    if (blur > 0) filterStr += ` blur(${blur}px)`;
    if (grayscale) filterStr += ` grayscale(100%)`;
    if (sepia) filterStr += ` sepia(100%)`;
    if (invert) filterStr += ` invert(100%)`;

    ctx.filter = filterStr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();
  };

  const commitFilterAdjustments = () => {
    if (canvasRef.current) {
      pushState(canvasRef.current);
      // Reset sliders to 100/0 so they don't double stack
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setBlur(0);
      setGrayscale(false);
      setSepia(false);
      setInvert(false);
    }
  };

  // Rotations & Flips
  const handleRotate = (angleDegrees: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(canvas, 0, 0);

    const is90or270 = angleDegrees === 90 || angleDegrees === 270;
    canvas.width = is90or270 ? offCanvas.height : offCanvas.width;
    canvas.height = is90or270 ? offCanvas.width : offCanvas.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angleDegrees * Math.PI) / 180);
    ctx.drawImage(offCanvas, -offCanvas.width / 2, -offCanvas.height / 2);
    ctx.restore();

    setResizeWidth(canvas.width);
    setResizeHeight(canvas.height);
    pushState(canvas);
  };

  const handleFlip = (horizontal: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(canvas, 0, 0);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.translate(horizontal ? canvas.width : 0, horizontal ? 0 : canvas.height);
    ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();

    pushState(canvas);
  };

  // Resize application
  const handleApplyResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;
    offCtx.drawImage(canvas, 0, 0);

    canvas.width = resizeWidth;
    canvas.height = resizeHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(offCanvas, 0, 0, resizeWidth, resizeHeight);

    pushState(canvas);
  };

  // Crop execution
  const handleApplyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Crop box in canvas coordinates
    const cropW = Math.max(10, Math.min(canvas.width, cropBox.width));
    const cropH = Math.max(10, Math.min(canvas.height, cropBox.height));
    const cropX = Math.max(0, Math.min(canvas.width - cropW, cropBox.x));
    const cropY = Math.max(0, Math.min(canvas.height - cropH, cropBox.y));

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const croppedData = ctx.getImageData(cropX, cropY, cropW, cropH);

    canvas.width = cropW;
    canvas.height = cropH;
    setResizeWidth(cropW);
    setResizeHeight(cropH);

    ctx.putImageData(croppedData, 0, 0);
    pushState(canvas);
    setIsCropping(false);
  };

  // Drawing mouse handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'draw') return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'draw' || !isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeTab === 'draw' && isDrawing && canvasRef.current) {
      setIsDrawing(false);
      pushState(canvasRef.current);
    }
  };

  // Text Overlay application
  const handleApplyText = () => {
    const canvas = canvasRef.current;
    if (!canvas || !textInput.trim()) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.save();
    ctx.font = `bold ${textSize}px sans-serif`;
    ctx.fillStyle = textColor;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 4;
    ctx.fillText(textInput, textX, textY);
    ctx.restore();

    pushState(canvas);
  };

  // Final Export
  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedFile) return;

    setIsSaving(true);
    try {
      let finalBlob: Blob;

      if (exportFormat === 'bmp') {
        finalBlob = canvasToBmpBlob(canvas);
      } else {
        const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : exportFormat === 'webp' ? 'image/webp' : 'image/png';
        finalBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
            mimeType,
            exportFormat === 'png' ? undefined : exportQuality
          );
        });
      }

      // If user specified target KB compression
      const targetKB = parseFloat(targetCompressKB);
      if (!isNaN(targetKB) && targetKB > 0) {
        const compressed = await compressImageToTargetSize(finalBlob, targetKB * 1024);
        finalBlob = compressed.blob;
      }

      const previewUrl = URL.createObjectURL(finalBlob);
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      const ext = exportFormat === 'jpeg' ? 'jpg' : exportFormat;
      const filename = `${baseName}_edited.${ext}`;
      const ratio = Math.max(0, Math.round(((selectedFile.size - finalBlob.size) / selectedFile.size) * 1000) / 10);

      setResult({
        blob: finalBlob,
        url: previewUrl,
        filename,
        originalSize: selectedFile.size,
        finalSize: finalBlob.size,
        format: exportFormat.toUpperCase(),
        compressionRatio: ratio,
        width: canvas.width,
        height: canvas.height,
        previewUrl,
      });
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setHistory([]);
    setHistoryIndex(-1);
    originalImageRef.current = null;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <AdSlot position="image-tools" onOpenAdmin={onOpenAdmin} />

      <div className="text-center space-y-2 mb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Online Image Editor
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto">
          Crop, resize, rotate, add text & drawing, apply visual filters, and export with optional compression.
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
          {!selectedFile ? (
            <FileUploader
              accept="image/*"
              multiple={false}
              title="Upload Image to Edit"
              subtitle="Drop JPG, PNG, WEBP photo to launch editor"
              onFilesSelected={handleFilesSelected}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-6">
              
              {/* Top Toolbar: Undo / Redo / Reset / Export */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    disabled={historyIndex <= 0}
                    onClick={handleUndo}
                    className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Undo"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={historyIndex >= history.length - 1}
                    onClick={handleRedo}
                    className="p-2 text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Redo"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    className="p-2 text-slate-600 hover:text-rose-600 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Reset to Original"
                  >
                    <ResetIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Sub Tool Switcher */}
                <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('adjust')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'adjust' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" /> Adjust
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('crop');
                      setIsCropping(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'crop' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" /> Crop
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('resize')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'resize' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" /> Resize
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('rotate')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'rotate' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Rotate
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('draw')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'draw' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Draw
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('text')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'text' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5" /> Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('export')}
                    className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      activeTab === 'export' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-rose-600 font-medium"
                >
                  Change Image
                </button>
              </div>

              {/* Main Workspace Grid: Controls + Canvas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Panel: Active Sub-Tool Controls */}
                <div className="lg:col-span-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 max-h-[500px] overflow-y-auto">
                  
                  {activeTab === 'adjust' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Filters & Adjustments
                        </h4>
                        <button
                          type="button"
                          onClick={commitFilterAdjustments}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                        >
                          Apply Filters
                        </button>
                      </div>

                      {/* Sliders */}
                      <div className="space-y-3 text-xs">
                        <div>
                          <div className="flex justify-between text-slate-700 mb-1">
                            <span>Brightness</span>
                            <span className="font-mono text-indigo-600 font-bold">{brightness}%</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="200"
                            value={brightness}
                            onChange={(e) => {
                              setBrightness(parseInt(e.target.value));
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-700 mb-1">
                            <span>Contrast</span>
                            <span className="font-mono text-indigo-600 font-bold">{contrast}%</span>
                          </div>
                          <input
                            type="range"
                            min="20"
                            max="200"
                            value={contrast}
                            onChange={(e) => {
                              setContrast(parseInt(e.target.value));
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-700 mb-1">
                            <span>Saturation</span>
                            <span className="font-mono text-indigo-600 font-bold">{saturation}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={saturation}
                            onChange={(e) => {
                              setSaturation(parseInt(e.target.value));
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-700 mb-1">
                            <span>Blur</span>
                            <span className="font-mono text-indigo-600 font-bold">{blur}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="15"
                            value={blur}
                            onChange={(e) => {
                              setBlur(parseInt(e.target.value));
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>

                        {/* Preset Toggles */}
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setGrayscale(!grayscale);
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                              grayscale ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            Grayscale
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSepia(!sepia);
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                              sepia ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            Sepia
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInvert(!invert);
                              setTimeout(applyFilterAdjustments, 10);
                            }}
                            className={`p-2 rounded-lg border text-center font-medium transition-colors ${
                              invert ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            Invert
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'crop' && (
                    <div className="space-y-4 text-xs">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                        Crop Dimensions
                      </h4>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-slate-600 block mb-1">Crop Width (px):</label>
                            <input
                              type="number"
                              value={cropBox.width}
                              onChange={(e) => setCropBox({ ...cropBox, width: parseInt(e.target.value) || 100 })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-slate-600 block mb-1">Crop Height (px):</label>
                            <input
                              type="number"
                              value={cropBox.height}
                              onChange={(e) => setCropBox({ ...cropBox, height: parseInt(e.target.value) || 100 })}
                              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyCrop}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" /> Apply Crop
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'resize' && (
                    <div className="space-y-4 text-xs">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                        Resize Dimensions
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-600 block mb-1">Width (px):</label>
                          <input
                            type="number"
                            value={resizeWidth}
                            onChange={(e) => {
                              const w = parseInt(e.target.value) || 10;
                              setResizeWidth(w);
                              if (lockAspect && canvasRef.current) {
                                setResizeHeight(Math.round((canvasRef.current.height / canvasRef.current.width) * w));
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-slate-600 block mb-1">Height (px):</label>
                          <input
                            type="number"
                            value={resizeHeight}
                            onChange={(e) => {
                              const h = parseInt(e.target.value) || 10;
                              setResizeHeight(h);
                              if (lockAspect && canvasRef.current) {
                                setResizeWidth(Math.round((canvasRef.current.width / canvasRef.current.height) * h));
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lockAspect}
                          onChange={(e) => setLockAspect(e.target.checked)}
                          className="rounded bg-slate-100 border-slate-300 text-indigo-600 focus:ring-0"
                        />
                        <span>Maintain Aspect Ratio</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleApplyResize}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Apply Resize
                      </button>
                    </div>
                  )}

                  {activeTab === 'rotate' && (
                    <div className="space-y-4 text-xs">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                        Rotate & Flip
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleRotate(90)}
                          className="p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 flex flex-col items-center gap-1.5 shadow-xs"
                        >
                          <RotateCw className="w-5 h-5 text-indigo-600" />
                          <span>Rotate 90° CW</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotate(270)}
                          className="p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 flex flex-col items-center gap-1.5 shadow-xs"
                        >
                          <RotateCcw className="w-5 h-5 text-indigo-600" />
                          <span>Rotate 90° CCW</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFlip(true)}
                          className="p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 flex flex-col items-center gap-1.5 shadow-xs"
                        >
                          <FlipHorizontal className="w-5 h-5 text-purple-600" />
                          <span>Flip Horizontal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFlip(false)}
                          className="p-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 flex flex-col items-center gap-1.5 shadow-xs"
                        >
                          <FlipVertical className="w-5 h-5 text-purple-600" />
                          <span>Flip Vertical</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'draw' && (
                    <div className="space-y-4 text-xs">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                        Freehand Drawing
                      </h4>
                      <p className="text-slate-500">Click and drag directly on the canvas image to draw.</p>
                      
                      <div>
                        <label className="text-slate-600 block mb-1">Brush Color:</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            className="w-10 h-10 rounded-lg bg-transparent border-0 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={brushColor}
                            onChange={(e) => setBrushColor(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono text-xs uppercase"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-700 mb-1">
                          <span>Brush Size</span>
                          <span className="font-mono text-indigo-600 font-bold">{brushSize}px</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="40"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'text' && (
                    <div className="space-y-4 text-xs">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                        Add Text Overlay
                      </h4>
                      <div>
                        <label className="text-slate-600 block mb-1">Text String:</label>
                        <input
                          type="text"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-600 block mb-1">Text Color:</label>
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-full h-9 rounded-lg bg-transparent cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-slate-600 block mb-1">Size (px):</label>
                          <input
                            type="number"
                            value={textSize}
                            onChange={(e) => setTextSize(parseInt(e.target.value) || 20)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-600 block mb-1">Position X:</label>
                          <input
                            type="number"
                            value={textX}
                            onChange={(e) => setTextX(parseInt(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-slate-600 block mb-1">Position Y:</label>
                          <input
                            type="number"
                            value={textY}
                            onChange={(e) => setTextY(parseInt(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyText}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Place Text
                      </button>
                    </div>
                  )}

                  {activeTab === 'export' && (
                    <div className="space-y-4 text-xs">
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider">
                        Export Settings
                      </h4>
                      <div>
                        <label className="text-slate-600 block mb-1.5">Format:</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['png', 'jpeg', 'webp'] as ImageFormat[]).map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setExportFormat(fmt)}
                              className={`py-2 rounded-lg border text-center font-bold uppercase transition-colors ${
                                exportFormat === fmt
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {fmt === 'jpeg' ? 'JPG' : fmt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-600 block mb-1">Optional Target Size Compression (KB):</label>
                        <input
                          type="text"
                          placeholder="e.g. 100 (for 100KB target)"
                          value={targetCompressKB}
                          onChange={(e) => setTargetCompressKB(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleExport}
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        {isSaving ? 'Processing Export...' : 'Finalize & Download'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: Master Interactive Canvas View */}
                <div className="lg:col-span-8 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center min-h-[420px] overflow-auto">
                  <div className="relative border border-slate-200 rounded-lg overflow-hidden shadow-md bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-white">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      className={`max-w-full max-h-[440px] block object-contain ${
                        activeTab === 'draw' ? 'cursor-crosshair' : 'cursor-default'
                      }`}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between w-full text-[11px] text-slate-500 px-2 font-mono">
                    <span>Dimensions: {resizeWidth} × {resizeHeight} px</span>
                    <span>Canvas Zoom: 100%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
