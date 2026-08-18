import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  User,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  Sliders,
  Printer,
  Download,
  FileText,
  CheckCircle2,
  RefreshCw,
  Plus,
  Minus,
  Sparkles,
  Layers,
  Palette,
  Eye,
  EyeOff,
  Move,
  Scissors,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { formatBytes, loadImage } from '../services/imageService';
import { triggerDownload } from '../services/zipService';
import { CameraCaptureModal } from '../components/CameraCaptureModal';

// Standard passport presets in mm and 300 DPI pixel dimensions
interface PassportPreset {
  id: string;
  name: string;
  country: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // at 300 DPI
  heightPx: number; // at 300 DPI
  notes: string;
}

const PASSPORT_PRESETS: PassportPreset[] = [
  {
    id: 'in_eu_uk',
    name: 'India / UK / Europe (35×45 mm)',
    country: 'India / UK / EU / Schengen',
    widthMm: 35,
    heightMm: 45,
    widthPx: 413,
    heightPx: 531,
    notes: 'Standard passport, visa & driving license',
  },
  {
    id: 'us_visa',
    name: 'US Passport / Visa (2×2 inch)',
    country: 'USA / India Visa',
    widthMm: 50.8,
    heightMm: 50.8,
    widthPx: 600,
    heightPx: 600,
    notes: 'US Visa, Green Card & Passport',
  },
  {
    id: 'in_pan_exam',
    name: 'India SSC / Exam / PAN (25×35 mm)',
    country: 'India Government Forms',
    widthMm: 25,
    heightMm: 35,
    widthPx: 295,
    heightPx: 413,
    notes: 'SSC, UPSC, Banking & PAN Card',
  },
  {
    id: 'canada',
    name: 'Canada Passport (50×70 mm)',
    country: 'Canada',
    widthMm: 50,
    heightMm: 70,
    widthPx: 590,
    heightPx: 827,
    notes: 'Official Canadian Passport & PR',
  },
];

// Paper Sizes for Print Sheet (dimensions in mm)
interface PaperSize {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // at 300 DPI
  heightPx: number;
}

const PAPER_SIZES: PaperSize[] = [
  { id: 'a4', name: 'A4 Paper (210 × 297 mm)', widthMm: 210, heightMm: 297, widthPx: 2480, heightPx: 3508 },
  { id: '4x6', name: '4 × 6 inch Photo Paper (102 × 152 mm)', widthMm: 101.6, heightMm: 152.4, widthPx: 1200, heightPx: 1800 },
  { id: '5x7', name: '5 × 7 inch Photo Paper (127 × 178 mm)', widthMm: 127, heightMm: 177.8, widthPx: 1500, heightPx: 2100 },
  { id: 'a5', name: 'A5 Paper (148 × 210 mm)', widthMm: 148, heightMm: 210, widthPx: 1748, heightPx: 2480 },
  { id: 'letter', name: 'US Letter (8.5 × 11 inch)', widthMm: 215.9, heightMm: 279.4, widthPx: 2550, heightPx: 3300 },
];

export const PassportPhotoTool: React.FC = () => {
  // Source Image States
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Passport Preset & Dimensions
  const [selectedPresetId, setSelectedPresetId] = useState<string>('in_eu_uk');
  const [customWidthMm, setCustomWidthMm] = useState<number>(35);
  const [customHeightMm, setCustomHeightMm] = useState<number>(45);

  // Framing, Zoom, Pan & Adjustments
  const [zoom, setZoom] = useState<number>(1.0); // 0.6x to 3.0x
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [rotationDeg, setRotationDeg] = useState<number>(0); // 0, 90, 180, 270
  const [fineRotation, setFineRotation] = useState<number>(0); // -15 to +15 deg
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);
  const [showFaceGuide, setShowFaceGuide] = useState<boolean>(true);
  const [showBorder, setShowBorder] = useState<boolean>(true);

  // Image Enhancements (Brightness, Contrast, Sharpness)
  const [brightness, setBrightness] = useState<number>(0); // -50 to +50
  const [contrast, setContrast] = useState<number>(1.0); // 0.5 to 1.8
  const [saturation, setSaturation] = useState<number>(1.0); // 0 to 2

  // Background Options (White, Blue, Original)
  const [bgColorOption, setBgColorOption] = useState<'original' | 'white' | 'blue'>('white');
  const [bgTolerance, setBgTolerance] = useState<number>(40); // 15 to 80

  // Output Size & Quality Control (50 KB → 2 MB)
  const [qualitySlider, setQualitySlider] = useState<number>(85); // 0 to 100
  const [singlePhotoSize, setSinglePhotoSize] = useState<number>(0);

  // Print Sheet Options
  const [copiesCount, setCopiesCount] = useState<number>(8);
  const [selectedPaperId, setSelectedPaperId] = useState<string>('4x6');
  const [currentSheetPage, setCurrentSheetPage] = useState<number>(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Active Tab: 'edit' or 'sheet'
  const [activeViewTab, setActiveViewTab] = useState<'edit' | 'sheet'>('edit');

  // Custom Output Naming
  const [customFilename, setCustomFilename] = useState<string>('passport_photo');

  // Canvas Refs & Interaction
  const singleCanvasRef = useRef<HTMLCanvasElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Preset Resolution Helper
  const activePreset: PassportPreset = selectedPresetId === 'custom'
    ? {
        id: 'custom',
        name: `Custom (${customWidthMm}×${customHeightMm} mm)`,
        country: 'Custom Format',
        widthMm: customWidthMm,
        heightMm: customHeightMm,
        widthPx: Math.round((customWidthMm / 25.4) * 300),
        heightPx: Math.round((customHeightMm / 25.4) * 300),
        notes: 'Custom dimensions',
      }
    : PASSPORT_PRESETS.find((p) => p.id === selectedPresetId) || PASSPORT_PRESETS[0];

  const activePaper = PAPER_SIZES.find((p) => p.id === selectedPaperId) || PAPER_SIZES[0];

  // Load Source File
  const handleLoadImageFile = async (file: File) => {
    try {
      const img = await loadImage(file);
      const url = URL.createObjectURL(file);
      setSourceImage(img);
      setSourceDataUrl(url);

      // Reset framing
      setZoom(1.0);
      setPanX(0);
      setPanY(0);
      setRotationDeg(0);
      setFineRotation(0);
      setIsFlippedH(false);
      setCustomFilename(`${file.name.replace(/\.[^/.]+$/, '')}_passport`);
    } catch (err) {
      console.error('Failed to load image for passport photo:', err);
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

  // Render Single Passport Photo Canvas
  const renderSinglePhoto = useCallback(() => {
    if (!sourceImage || !singleCanvasRef.current) return;
    const canvas = singleCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = activePreset.widthPx;
    canvas.height = activePreset.heightPx;

    // Clear background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Enhancements (Brightness, Contrast, Saturation)
    ctx.filter = `brightness(${100 + brightness}%) contrast(${contrast * 100}%) saturate(${saturation * 100}%)`;

    // Center translation and rotation
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

    // High-Quality Edge-Connected Background Replacement (White or Blue)
    if (bgColorOption !== 'original') {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const w = canvas.width;
      const h = canvas.height;

      // Target background RGB
      let targetR = 255, targetG = 255, targetB = 255;
      if (bgColorOption === 'blue') {
        // Standard official passport studio blue
        targetR = 64;
        targetG = 138;
        targetB = 224; // #408AE0
      }

      // Sample boundary perimeter pixels (top edge, left edge, right edge)
      let sampleSumR = 0, sampleSumG = 0, sampleSumB = 0, sampleCount = 0;
      for (let x = 0; x < w; x += 4) {
        // Top edge
        const idx = x * 4;
        sampleSumR += data[idx]; sampleSumG += data[idx + 1]; sampleSumB += data[idx + 2]; sampleCount++;
      }
      for (let y = 0; y < Math.floor(h * 0.4); y += 4) {
        // Left & Right upper edges
        const idxL = (y * w) * 4;
        const idxR = (y * w + (w - 1)) * 4;
        sampleSumR += data[idxL] + data[idxR];
        sampleSumG += data[idxL + 1] + data[idxR + 1];
        sampleSumB += data[idxL + 2] + data[idxR + 2];
        sampleCount += 2;
      }

      const avgBgR = sampleCount > 0 ? sampleSumR / sampleCount : 240;
      const avgBgG = sampleCount > 0 ? sampleSumG / sampleCount : 240;
      const avgBgB = sampleCount > 0 ? sampleSumB / sampleCount : 240;

      const tolerance = bgTolerance;
      const featherRange = 25;

      // Scan and replace background
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Distance from sampled background color
          const dist = Math.sqrt((r - avgBgR) ** 2 + (g - avgBgG) ** 2 + (b - avgBgB) ** 2);

          if (dist < tolerance) {
            // Pure backdrop replacement
            data[i] = targetR;
            data[i + 1] = targetG;
            data[i + 2] = targetB;
          } else if (dist < tolerance + featherRange) {
            // Soft feathered boundary blend
            const blend = (dist - tolerance) / featherRange;
            data[i] = Math.round(targetR * (1 - blend) + r * blend);
            data[i + 1] = Math.round(targetG * (1 - blend) + g * blend);
            data[i + 2] = Math.round(targetB * (1 - blend) + b * blend);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    // Draw Subtle Outer Cutting Border if enabled
    if (showBorder) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    }

    // Calculate file size
    const quality = Math.min(0.98, Math.max(0.4, qualitySlider / 100));
    canvas.toBlob(
      (blob) => {
        if (blob) setSinglePhotoSize(blob.size);
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
    brightness,
    contrast,
    saturation,
    bgColorOption,
    bgTolerance,
    showBorder,
    qualitySlider,
  ]);

  // Calculate Sheet Layout Geometry
  const calculateSheetLayout = useCallback(() => {
    const marginMm = 8; // 8mm paper border margin
    const gapMm = 3; // 3mm spacing between photos

    const usableWidthMm = activePaper.widthMm - marginMm * 2;
    const usableHeightMm = activePaper.heightMm - marginMm * 2;

    const cols = Math.max(1, Math.floor((usableWidthMm + gapMm) / (activePreset.widthMm + gapMm)));
    const rows = Math.max(1, Math.floor((usableHeightMm + gapMm) / (activePreset.heightMm + gapMm)));
    const photosPerPage = cols * rows;
    const totalPages = Math.max(1, Math.ceil(copiesCount / photosPerPage));

    return { cols, rows, photosPerPage, totalPages, marginMm, gapMm };
  }, [activePaper, activePreset, copiesCount]);

  // Render Print Sheet Canvas
  const renderPrintSheet = useCallback(() => {
    if (!singleCanvasRef.current || !sheetCanvasRef.current) return;
    const sheetCanvas = sheetCanvasRef.current;
    const singleCanvas = singleCanvasRef.current;
    const ctx = sheetCanvas.getContext('2d');
    if (!ctx) return;

    sheetCanvas.width = activePaper.widthPx;
    sheetCanvas.height = activePaper.heightPx;

    // Crisp White Paper Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

    const { cols, rows, photosPerPage, marginMm, gapMm } = calculateSheetLayout();

    const marginPx = Math.round((marginMm / 25.4) * 300);
    const gapPx = Math.round((gapMm / 25.4) * 300);
    const photoWPx = activePreset.widthPx;
    const photoHPx = activePreset.heightPx;

    // Calculate start index for current sheet page
    const pageStartIndex = (currentSheetPage - 1) * photosPerPage;
    const photosOnThisPage = Math.min(copiesCount - pageStartIndex, photosPerPage);

    // Draw Grid with Cutting Guides
    let photoIndex = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (photoIndex >= photosOnThisPage) break;

        const x = marginPx + c * (photoWPx + gapPx);
        const y = marginPx + r * (photoHPx + gapPx);

        // Draw Single Photo Instance
        ctx.drawImage(singleCanvas, x, y, photoWPx, photoHPx);

        // Draw Crisp Cutting Guides (Corner Marks)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        const markLen = 14;

        // Top-Left corner
        ctx.beginPath();
        ctx.moveTo(x - 2, y); ctx.lineTo(x - 2 - markLen, y);
        ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 2 - markLen);
        ctx.stroke();

        // Top-Right corner
        ctx.beginPath();
        ctx.moveTo(x + photoWPx + 2, y); ctx.lineTo(x + photoWPx + 2 + markLen, y);
        ctx.moveTo(x + photoWPx, y - 2); ctx.lineTo(x + photoWPx, y - 2 - markLen);
        ctx.stroke();

        // Bottom-Left corner
        ctx.beginPath();
        ctx.moveTo(x - 2, y + photoHPx); ctx.lineTo(x - 2 - markLen, y + photoHPx);
        ctx.moveTo(x, y + photoHPx + 2); ctx.lineTo(x, y + photoHPx + 2 + markLen);
        ctx.stroke();

        // Bottom-Right corner
        ctx.beginPath();
        ctx.moveTo(x + photoWPx + 2, y + photoHPx); ctx.lineTo(x + photoWPx + 2 + markLen, y + photoHPx);
        ctx.moveTo(x + photoWPx, y + photoHPx + 2); ctx.lineTo(x + photoWPx, y + photoHPx + 2 + markLen);
        ctx.stroke();

        photoIndex++;
      }
    }
  }, [activePaper, activePreset, copiesCount, currentSheetPage, calculateSheetLayout]);

  useEffect(() => {
    if (sourceImage) {
      renderSinglePhoto();
    }
  }, [sourceImage, renderSinglePhoto]);

  useEffect(() => {
    if (sourceImage && activeViewTab === 'sheet') {
      renderPrintSheet();
    }
  }, [sourceImage, activeViewTab, renderPrintSheet]);

  // Pan / Drag Handlers
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

  // Touch Handlers for Mobile Pan
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

  // Export Single Photo (.jpg)
  const handleDownloadSinglePhoto = () => {
    const canvas = singleCanvasRef.current;
    if (!canvas) return;

    const base = customFilename.trim() || 'passport_photo';
    const filename = `${base.replace(/\.[^/.]+$/, '')}_single.jpg`;
    const quality = Math.min(0.98, Math.max(0.4, qualitySlider / 100));

    canvas.toBlob(
      (blob) => {
        if (blob) {
          triggerDownload(blob, filename);
          confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
        }
      },
      'image/jpeg',
      quality
    );
  };

  // Export 300 DPI Print Sheet PDF
  const handleDownloadPrintSheetPdf = async () => {
    if (!singleCanvasRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const { photosPerPage, totalPages, cols, rows, marginMm, gapMm } = calculateSheetLayout();
      const pdfDoc = await PDFDocument.create();

      // Convert mm to points (1 mm = 2.83465 pt)
      const ptPerMm = 72 / 25.4;
      const paperWPt = activePaper.widthMm * ptPerMm;
      const paperHPt = activePaper.heightMm * ptPerMm;

      // Get JPEG data of single photo
      const singleJpgData = singleCanvasRef.current.toDataURL('image/jpeg', 0.95);
      const embeddedPhoto = await pdfDoc.embedJpg(singleJpgData);

      const photoWPt = activePreset.widthMm * ptPerMm;
      const photoHPt = activePreset.heightMm * ptPerMm;
      const marginPt = marginMm * ptPerMm;
      const gapPt = gapMm * ptPerMm;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = pdfDoc.addPage([paperWPt, paperHPt]);
        const startIdx = (pageNum - 1) * photosPerPage;
        const countOnPage = Math.min(copiesCount - startIdx, photosPerPage);

        let pIdx = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (pIdx >= countOnPage) break;

            const x = marginPt + c * (photoWPt + gapPt);
            // PDF origin is bottom-left
            const y = paperHPt - marginPt - (r + 1) * photoHPt - r * gapPt;

            page.drawImage(embeddedPhoto, {
              x,
              y,
              width: photoWPt,
              height: photoHPt,
            });

            pIdx++;
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const base = customFilename.trim() || 'passport_sheet';
      const filename = `${base.replace(/\.[^/.]+$/, '')}_print_sheet.pdf`;

      triggerDownload(blob, filename);
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
    } catch (err) {
      console.error('PDF sheet generation error:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Native Browser Print Trigger
  const handleNativePrint = () => {
    if (!sheetCanvasRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataUrl = sheetCanvasRef.current.toDataURL('image/png');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Passport Photos</title>
          <style>
            @page { size: auto; margin: 0mm; }
            body { margin: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
            img { width: 100%; height: auto; max-height: 100vh; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const { totalPages, photosPerPage } = calculateSheetLayout();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Title & Description */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
          Passport Size Photo Maker & Print Sheet Studio
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Create standard passport, visa & ID photos with White/Blue backgrounds, precise face alignment guide, and print-ready multi-copy sheets.
        </p>
      </div>

      {!sourceImage ? (
        /* Step 1: Upload or Camera Input */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Upload Photo */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-8 rounded-3xl bg-white border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-center flex flex-col items-center justify-center space-y-4 cursor-pointer shadow-xs group"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                📁 Upload Portrait Photo
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select high-resolution photo from device (JPG, PNG, WEBP)
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xs">
              Browse Device
            </span>
          </div>

          {/* Camera Capture */}
          <div
            onClick={() => setIsCameraOpen(true)}
            className="p-8 rounded-3xl bg-white border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-center flex flex-col items-center justify-center space-y-4 cursor-pointer shadow-xs group"
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                📷 Take Live Camera Photo
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Snap face portrait directly using camera
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
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
        /* Step 2: Main Passport Workspace (Crop, Alignment, Background & Sheet Generator) */
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Control Bar: Mode Tabs & Preset Selector */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            
            {/* View Switcher: Single Photo Editor vs Print Sheet Studio */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveViewTab('edit')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeViewTab === 'edit'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 text-indigo-600" />
                1. Single Photo & Face Framing
              </button>

              <button
                type="button"
                onClick={() => setActiveViewTab('sheet')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeViewTab === 'sheet'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                2. Multi-Photo Print Sheet ({copiesCount} Copies)
              </button>
            </div>

            {/* Change / Retake Photo */}
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
                New Photo
              </button>
            </div>
          </div>

          {activeViewTab === 'edit' ? (
            /* TAB 1: Single Photo Framing & Background Editor */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column (7 / 12): Interactive Canvas Viewport with Face Guide */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                  
                  {/* Viewport Canvas */}
                  <div className="relative w-full bg-slate-100/90 rounded-2xl border border-slate-200 flex items-center justify-center p-4 min-h-[360px] overflow-hidden">
                    <div
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleMouseUp}
                      className="relative cursor-move select-none shadow-lg rounded-sm overflow-hidden bg-white"
                      style={{
                        width: '280px',
                        aspectRatio: `${activePreset.widthMm} / ${activePreset.heightMm}`,
                      }}
                    >
                      <canvas
                        ref={singleCanvasRef}
                        className="w-full h-full object-contain block"
                      />

                      {/* Official Face Alignment Guide Overlay */}
                      {showFaceGuide && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                          {/* Face Oval */}
                          <div
                            className="border-2 border-dashed border-emerald-400/80 rounded-full"
                            style={{
                              width: '68%',
                              height: '72%',
                              marginTop: '-8%',
                            }}
                          />
                          {/* Eye Line & Chin Line */}
                          <div className="absolute top-[38%] left-0 right-0 border-t border-dotted border-emerald-400/60" />
                          <div className="absolute top-[72%] left-0 right-0 border-t border-dotted border-emerald-400/60" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Canvas Controls Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
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

                    {/* Rotate, Flip & Guide toggles */}
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
                        onClick={() => setShowFaceGuide((g) => !g)}
                        className={`px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          showFaceGuide ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        Face Guide
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
                        title="Reset Framing Position"
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

              {/* Right Column (5 / 12): Dimensions, Background Options & Size Slider */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
                  
                  {/* 1. Country & Passport Dimension Presets */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Passport Size Preset:
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {PASSPORT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPresetId(preset.id)}
                          className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                            selectedPresetId === preset.id
                              ? 'bg-indigo-50/70 border-indigo-500 shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                            <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {preset.widthMm}×{preset.heightMm}mm
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{preset.notes}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Background Color Selector (White / Blue / Original) */}
                  <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" />
                      Background Color:
                    </label>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {/* White Background */}
                      <button
                        type="button"
                        onClick={() => setBgColorOption('white')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          bgColorOption === 'white'
                            ? 'bg-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                            : 'bg-white/80 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full border border-slate-300 bg-white shadow-2xs"></span>
                        <span className="text-[11px] font-bold text-slate-800">White</span>
                      </button>

                      {/* Passport Blue Background */}
                      <button
                        type="button"
                        onClick={() => setBgColorOption('blue')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          bgColorOption === 'blue'
                            ? 'bg-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                            : 'bg-white/80 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-[#408AE0] shadow-2xs"></span>
                        <span className="text-[11px] font-bold text-slate-800">Passport Blue</span>
                      </button>

                      {/* Original Background */}
                      <button
                        type="button"
                        onClick={() => setBgColorOption('original')}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          bgColorOption === 'original'
                            ? 'bg-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                            : 'bg-white/80 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-200 border border-slate-300"></span>
                        <span className="text-[11px] font-bold text-slate-800">Original</span>
                      </button>
                    </div>

                    {bgColorOption !== 'original' && (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>Edge Tolerance:</span>
                          <span className="font-mono font-semibold">{bgTolerance}</span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={80}
                          value={bgTolerance}
                          onChange={(e) => setBgTolerance(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. File Size & Quality Slider (50 KB → 2 MB) */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">Quality & File Size:</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {singlePhotoSize > 0 ? formatBytes(singlePhotoSize) : '~60 KB'}
                      </span>
                    </div>

                    <input
                      type="range"
                      min={30}
                      max={100}
                      value={qualitySlider}
                      onChange={(e) => setQualitySlider(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />

                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Small Size (~40 KB)</span>
                      <span>Balanced</span>
                      <span>High DPI (~500 KB)</span>
                    </div>
                  </div>

                  {/* 4. Output Filename & Download Single Photo */}
                  <div className="space-y-2 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500">Output Filename:</label>
                      <input
                        type="text"
                        value={customFilename}
                        onChange={(e) => setCustomFilename(e.target.value)}
                        placeholder="passport_photo"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadSinglePhoto}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Single Photo ({singlePhotoSize > 0 ? formatBytes(singlePhotoSize) : 'JPG'})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveViewTab('sheet')}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Generate Print Sheet ({copiesCount} Photos) →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Multi-Photo Print Sheet Studio */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column (7 / 12): Print Sheet Canvas Preview */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      Print Sheet Preview ({activePaper.name})
                    </span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={currentSheetPage <= 1}
                          onClick={() => setCurrentSheetPage((p) => Math.max(1, p - 1))}
                          className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-semibold text-slate-700">
                          Page {currentSheetPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentSheetPage >= totalPages}
                          onClick={() => setCurrentSheetPage((p) => Math.min(totalPages, p + 1))}
                          className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sheet Canvas Container */}
                  <div className="w-full bg-slate-100 rounded-2xl border border-slate-200 p-4 flex items-center justify-center min-h-[380px] overflow-auto">
                    <div className="shadow-xl bg-white border border-slate-300 rounded-xs max-w-full">
                      <canvas
                        ref={sheetCanvasRef}
                        className="max-h-[460px] w-auto h-auto object-contain block"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 text-center">
                    Sheet rendered at 300 DPI high resolution with precise corner cutting crop marks.
                  </p>
                </div>
              </div>

              {/* Right Column (5 / 12): Paper & Copies Controls & Print PDF Downloads */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-5">
                  
                  {/* Paper Type Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Paper Size:
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {PAPER_SIZES.map((paper) => (
                        <button
                          key={paper.id}
                          type="button"
                          onClick={() => {
                            setSelectedPaperId(paper.id);
                            setCurrentSheetPage(1);
                          }}
                          className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                            selectedPaperId === paper.id
                              ? 'bg-emerald-50/70 border-emerald-500 shadow-2xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{paper.name}</span>
                            <span className="text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {paper.widthMm}×{paper.heightMm}mm
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Number of Photo Copies */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">Total Photo Copies:</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg">
                        {copiesCount} Copies ({totalPages} {totalPages === 1 ? 'Page' : 'Pages'})
                      </span>
                    </div>

                    {/* Quick Preset Copy Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[1, 4, 8, 12, 16, 20, 30, 50].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            setCopiesCount(num);
                            setCurrentSheetPage(1);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            copiesCount === num
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Download PDF Sheet & Print Now */}
                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadPrintSheetPdf}
                      disabled={isGeneratingPdf}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isGeneratingPdf ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      Download 300 DPI Print Sheet (PDF)
                    </button>

                    <button
                      type="button"
                      onClick={handleNativePrint}
                      className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Print Now (Borderless Photo Printer)
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveViewTab('edit')}
                      className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      ← Back to Single Photo Editing
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
