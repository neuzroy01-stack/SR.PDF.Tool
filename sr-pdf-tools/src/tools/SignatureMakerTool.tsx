import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  Crop as CropIcon,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  Sliders,
  Download,
  FileText,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Layers,
  Eye,
  RotateCcw,
  Maximize2,
  Scissors,
  Wand2,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { formatBytes, loadImage } from '../services/imageService';
import { triggerDownload } from '../services/zipService';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

interface SignaturePreset {
  id: string;
  name: string;
  ratio: number; // width / height
  desc: string;
}

const SIGNATURE_PRESETS: SignaturePreset[] = [
  { id: 'standard', name: 'Signature Standard (3:1)', ratio: 3 / 1, desc: '300 × 100 px standard' },
  { id: 'pan_card', name: 'PAN Card Signature (2:1)', ratio: 2 / 1, desc: '4.5 × 2 cm official PAN format' },
  { id: 'exam_app', name: 'Govt Exam / Application (3.5:1)', ratio: 3.5 / 1, desc: 'SSC, UPSC & Bank forms' },
  { id: 'custom', name: 'Custom Free Crop', ratio: 0, desc: 'Free aspect ratio' },
];

export const SignatureMakerTool: React.FC = () => {
  // Input Photo States
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop & Transform States
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard');
  const [zoom, setZoom] = useState<number>(1.0); // 0.6x to 3.0x
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotationDeg, setRotationDeg] = useState<number>(0); // 0, 90, 180, 270
  const [fineRotation, setFineRotation] = useState<number>(0); // -15 to +15 deg
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);

  // Ink & Document Paper Cleaning Enhancement
  const [isInkEnhanced, setIsInkEnhanced] = useState<boolean>(true);
  const [contrast, setContrast] = useState<number>(1.3);
  const [brightness, setBrightness] = useState<number>(10);

  // File Size Slider: 15 KB to 2 MB (represented in KB: 15 to 2048)
  const [targetSizeKb, setTargetSizeKb] = useState<number>(30); // default 30 KB
  const [actualFileSizeJpg, setActualFileSizeJpg] = useState<number>(0);
  const [actualFileSizePdf, setActualFileSizePdf] = useState<number>(0);

  // Custom Output Naming
  const [customFilename, setCustomFilename] = useState<string>('my_signature');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Canvas Refs & Interaction
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const activePreset = SIGNATURE_PRESETS.find((p) => p.id === selectedPresetId) || SIGNATURE_PRESETS[0];

  // Load Source File
  const handleLoadImageFile = async (file: File) => {
    try {
      const img = await loadImage(file);
      const url = URL.createObjectURL(file);
      setSourceImage(img);
      setSourceDataUrl(url);

      // Reset transforms
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setRotationDeg(0);
      setFineRotation(0);
      setIsFlippedH(false);
      setCustomFilename(`${file.name.replace(/\.[^/.]+$/, '')}_signature`);
    } catch (err) {
      console.error('Failed to load signature photo:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLoadImageFile(e.target.files[0]);
    }
  };

  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    handleLoadImageFile(file);
  };

  // Render & Process Signature on Canvas
  const renderSignature = useCallback(() => {
    if (!sourceImage || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Determine viewport canvas resolution (e.g. 600 x 200 for 3:1)
    const baseW = 600;
    const baseH = activePreset.ratio > 0 ? Math.round(baseW / activePreset.ratio) : 250;

    canvas.width = baseW;
    canvas.height = baseH;

    // Fill pure white paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Filters (Contrast & Brightness)
    ctx.filter = `brightness(${100 + brightness}%) contrast(${contrast * 100}%)`;

    // Translation & Rotation Center
    const cx = canvas.width / 2 + panX;
    const cy = canvas.height / 2 + panY;
    ctx.translate(cx, cy);

    const totalRotation = ((rotationDeg + fineRotation) * Math.PI) / 180;
    ctx.rotate(totalRotation);
    if (isFlippedH) ctx.scale(-1, 1);

    // Scaling
    const scaleFactor = Math.max(canvas.width / sourceImage.width, canvas.height / sourceImage.height) * zoom;
    const drawW = sourceImage.width * scaleFactor;
    const drawH = sourceImage.height * scaleFactor;

    ctx.drawImage(sourceImage, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Ink Enhancement / Paper Cleaner Algorithm
    if (isInkEnhanced) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        // Perceived luminance
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // If background paper (light gray/yellow/off-white), whiten cleanly
        if (lum > 175) {
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
        } else if (lum > 135) {
          // Soft transition to avoid jagged edges
          const factor = (lum - 135) / 40;
          d[i] = Math.round(r * (1 - factor) + 255 * factor);
          d[i + 1] = Math.round(g * (1 - factor) + 255 * factor);
          d[i + 2] = Math.round(b * (1 - factor) + 255 * factor);
        } else {
          // Darken ink strokes to crisp blue/black
          d[i] = Math.max(0, Math.round(r * 0.7));
          d[i + 1] = Math.max(0, Math.round(g * 0.7));
          d[i + 2] = Math.max(0, Math.round(b * 0.75));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Dynamic File Size Optimization Calculation
    // Map targetSizeKb (15 to 2048 KB) to quality & downscale ratio
    let quality = 0.92;
    if (targetSizeKb <= 25) {
      quality = 0.55;
    } else if (targetSizeKb <= 50) {
      quality = 0.75;
    } else if (targetSizeKb <= 200) {
      quality = 0.88;
    } else {
      quality = 0.96;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setActualFileSizeJpg(blob.size);
          // PDF approx overhead
          setActualFileSizePdf(blob.size + 4200);
        }
      },
      'image/jpeg',
      quality
    );
  }, [
    sourceImage,
    activePreset,
    zoom,
    panX,
    panY,
    rotationDeg,
    fineRotation,
    isFlippedH,
    isInkEnhanced,
    contrast,
    brightness,
    targetSizeKb,
  ]);

  useEffect(() => {
    if (sourceImage) {
      renderSignature();
    }
  }, [sourceImage, renderSignature]);

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setPanX(e.clientX - dragStartRef.current.x);
    setPanY(e.clientY - dragStartRef.current.y);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Touch Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    setPanX(e.touches[0].clientX - dragStartRef.current.x);
    setPanY(e.touches[0].clientY - dragStartRef.current.y);
  };

  // Export Download Handlers
  const handleDownloadJpg = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let base = customFilename.trim() || 'signature';
    if (!base.endsWith('.jpg')) base = `${base.replace(/\.[^/.]+$/, '')}.jpg`;

    let quality = 0.92;
    if (targetSizeKb <= 25) quality = 0.55;
    else if (targetSizeKb <= 50) quality = 0.75;
    else if (targetSizeKb <= 200) quality = 0.88;
    else quality = 0.96;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          triggerDownload(blob, base);
          confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
        }
      },
      'image/jpeg',
      quality
    );
  };

  const handleDownloadPdf = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    setIsGenerating(true);

    let base = customFilename.trim() || 'signature';
    if (!base.endsWith('.pdf')) base = `${base.replace(/\.[^/.]+$/, '')}.pdf`;

    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([canvas.width + 40, canvas.height + 40]);

      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const jpgImage = await pdfDoc.embedJpg(jpgDataUrl);

      page.drawImage(jpgImage, {
        x: 20,
        y: 20,
        width: canvas.width,
        height: canvas.height,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      triggerDownload(blob, base);
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
    } catch (err) {
      console.error('Signature PDF generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Title & Description */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Signature Photo Maker & Resizer
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Upload or take a photo of your paper signature, crop extra borders, enhance ink clarity, and compress to official file size (15 KB – 2 MB).
        </p>
      </div>

      {!sourceImage ? (
        /* Step 1: Initial Input Options (Upload or Camera) */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Upload Signature Photo */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-8 rounded-3xl bg-white border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-center flex flex-col items-center justify-center space-y-4 cursor-pointer shadow-xs group"
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                📁 Upload Signature Photo
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Choose signature photo from gallery or computer (JPG, PNG)
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
              Browse Signature
            </span>
          </div>

          {/* Take Signature Photo */}
          <div
            onClick={() => setIsCameraOpen(true)}
            className="p-8 rounded-3xl bg-white border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-center flex flex-col items-center justify-center space-y-4 cursor-pointer shadow-xs group"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                📷 Take Signature Photo
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Snap paper signature directly with phone/web camera
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xs">
              Open Camera
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        /* Step 2: Interactive Crop, Zoom, Rotate, Size Slider & Export */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Bar: Action Switchers */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Crop Preset:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {SIGNATURE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedPresetId === preset.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Retake
              </button>
              <button
                type="button"
                onClick={() => setSourceImage(null)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Again
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Col (7 / 12): Interactive Crop & Framing Viewport */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                
                {/* Viewport Canvas */}
                <div className="relative w-full bg-slate-100/90 rounded-2xl border border-slate-200 flex items-center justify-center p-4 min-h-[260px] overflow-hidden">
                  <div
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                    className="relative cursor-move select-none shadow-md rounded-lg overflow-hidden border-2 border-indigo-400 bg-white"
                    style={{
                      width: '100%',
                      maxWidth: '480px',
                      aspectRatio: activePreset.ratio > 0 ? `${activePreset.ratio}` : '3/1',
                    }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      className="w-full h-full object-contain block"
                    />

                    {/* Subtle Crosshair Guide Lines */}
                    <div className="absolute inset-0 pointer-events-none border border-dashed border-indigo-300/40 grid grid-cols-3 grid-rows-3" />
                  </div>
                </div>

                {/* Transform Toolbar: Zoom, Rotate, Straighten */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    
                    {/* Zoom */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-700">Zoom:</span>
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono font-semibold text-slate-900 w-10 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setZoom((z) => Math.min(3.0, z + 0.1))}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Rotate & Flip */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRotationDeg((r) => (r + 90) % 360)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        90°
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsFlippedH((f) => !f)}
                        className={`px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isFlippedH ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                        Flip
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setZoom(1.0);
                          setPanX(0);
                          setPanY(0);
                          setFineRotation(0);
                          setRotationDeg(0);
                        }}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                        title="Reset Crop Position"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fine Straighten Slider */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500 font-medium shrink-0">Straighten:</span>
                    <input
                      type="range"
                      min={-15}
                      max={15}
                      step={0.5}
                      value={fineRotation}
                      onChange={(e) => setFineRotation(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="font-mono text-slate-700 w-8 text-right">{fineRotation}°</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col (5 / 12): Ink Clean Enhancer, File Size Slider & Download */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
                
                {/* 1. Paper Cleaner & Ink Enhancer */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                      Clean Paper & Enhance Ink:
                    </label>
                    <input
                      type="checkbox"
                      checked={isInkEnhanced}
                      onChange={(e) => setIsInkEnhanced(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Removes paper shadows and turns strokes into clean, high-contrast dark ink on pure white.
                  </p>
                </div>

                {/* 2. File Size Slider (15 KB to 2 MB) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Target File Size:</span>
                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                      {targetSizeKb >= 1024 ? `${(targetSizeKb / 1024).toFixed(1)} MB` : `${targetSizeKb} KB`}
                    </span>
                  </div>

                  {/* Slider: 15 KB to 2048 KB (2 MB) */}
                  <input
                    type="range"
                    min={15}
                    max={2048}
                    step={5}
                    value={targetSizeKb}
                    onChange={(e) => setTargetSizeKb(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />

                  <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                    <span>Smaller (15 KB)</span>
                    <span>Standard (50 KB)</span>
                    <span>High Res (2 MB)</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[15, 25, 50, 100, 500, 1024, 2048].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTargetSizeKb(sz)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                          targetSizeKb === sz
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {sz >= 1024 ? `${sz / 1024}MB` : `${sz}KB`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Live File Size Output Feedback */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Calculated File Size:</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                    {actualFileSizeJpg > 0 ? formatBytes(actualFileSizeJpg) : `${targetSizeKb} KB`}
                  </span>
                </div>

                {/* 4. Output Filename Field */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">Output Filename:</label>
                  <input
                    type="text"
                    value={customFilename}
                    onChange={(e) => setCustomFilename(e.target.value)}
                    placeholder="signature"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 5. Download Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadJpg}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download JPG ({actualFileSizeJpg > 0 ? formatBytes(actualFileSizeJpg) : `${targetSizeKb} KB`})
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGenerating}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
