import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Camera,
  Wand2,
  Minimize2,
  Maximize2,
  FileText,
  Sparkles,
  Sliders,
  Crop as CropIcon,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Type,
  Pencil,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Download,
  CheckCircle2,
  RotateCcw,
  Eye,
  ShieldCheck,
  Zap,
  Layers,
  FileCheck,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import confetti from 'canvas-confetti';
import { ImageFormat, ImageFileItem, ConversionResult, ProcessingState } from '../types';
import {
  loadImage,
  convertImageFormat,
  compressImageToTargetSize,
  enhanceScanData,
  formatBytes,
} from '../services/imageService';
import { triggerDownload } from '../services/zipService';
import { CameraCaptureModal } from './CameraCaptureModal';
import { ImageCropModal } from './ImageCropModal';
import { ProgressBar } from './ProgressBar';
import { AdSlot } from './AdSlot';
import { ToolId } from '../types';
import { PenTool, User } from 'lucide-react';

interface UnifiedWorkspaceProps {
  onOpenAdmin?: () => void;
  onSelectTool?: (toolId: ToolId) => void;
  onSelectPdfTools?: () => void;
}

type WorkspaceTab = 'edit' | 'convert' | 'compress';
type EditSubTool = 'adjust' | 'crop' | 'rotate' | 'resize' | 'draw' | 'text';

export const UnifiedWorkspace: React.FC<UnifiedWorkspaceProps> = ({
  onOpenAdmin,
  onSelectTool,
  onSelectPdfTools,
}) => {
  // File & Camera states
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [activeDataUrl, setActiveDataUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalImagesInputRef = useRef<HTMLInputElement>(null);

  // Multi-image list for PDF creation
  const [pdfImageList, setPdfImageList] = useState<ImageFileItem[]>([]);

  // Main navigation tab: Edit | Convert | Compress
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('convert');

  // Edit sub-tools & history
  const [activeEditTool, setActiveEditTool] = useState<EditSubTool>('adjust');
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Adjustment filters
  const [brightness, setBrightness] = useState<number>(0); // -100 to 100
  const [contrast, setContrast] = useState<number>(1); // 0.2 to 2.5
  const [saturation, setSaturation] = useState<number>(1); // 0 to 2.5
  const [isGrayscale, setIsGrayscale] = useState<boolean>(false);
  const [isSepia, setIsSepia] = useState<boolean>(false);
  const [isInvert, setIsInvert] = useState<boolean>(false);
  const [isDocScan, setIsDocScan] = useState<boolean>(false);

  // Resize controls
  const [resizeWidth, setResizeWidth] = useState<number>(0);
  const [resizeHeight, setResizeHeight] = useState<number>(0);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);

  // Crop controls
  const [cropAspect, setCropAspect] = useState<string>('free'); // free, 1:1, 4:3, 16:9, 3:2, 9:16

  // Drawing controls
  const [brushColor, setBrushColor] = useState<string>('#ef4444');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [isEraser, setIsEraser] = useState<boolean>(false);

  // Text overlay controls
  const [overlayText, setOverlayText] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [textSize, setTextSize] = useState<number>(24);

  // Convert tab options
  const [targetFormat, setTargetFormat] = useState<ImageFormat | 'pdf'>('jpeg');
  const [pdfPageSize, setPdfPageSize] = useState<'a4' | 'letter' | 'original'>('a4');
  const [pdfMargin, setPdfMargin] = useState<number>(15);
  const [pdfDocScanMode, setPdfDocScanMode] = useState<boolean>(false);

  // Compress tab options
  const [compressionSliderVal, setCompressionSliderVal] = useState<number>(50); // 0 to 100
  const [minOutputBytes, setMinOutputBytes] = useState<number>(50 * 1024);
  const [maxOutputBytes, setMaxOutputBytes] = useState<number>(2 * 1024 * 1024);
  const [isMaxCompression, setIsMaxCompression] = useState<boolean>(false);

  // Processing & Result states
  const [procState, setProcState] = useState<ProcessingState>({
    isProcessing: false,
    stepMessage: '',
    progressPercent: 0,
    error: null,
  });
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMouseDownRef = useRef<boolean>(false);
  const lastCoordRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize/Load image into memory
  const handleLoadNewFile = useCallback(async (file: File) => {
    try {
      setProcState({ isProcessing: true, stepMessage: 'Loading image...', progressPercent: 30, error: null });
      setConversionResult(null);

      const img = await loadImage(file);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      setImageDims({ width: w, height: h });
      setResizeWidth(w);
      setResizeHeight(h);

      const objectUrl = URL.createObjectURL(file);
      setActiveFile(file);
      setActiveDataUrl(objectUrl);

      // History stack setup
      setHistoryStack([objectUrl]);
      setHistoryIndex(0);

      // Multi-image list setup
      setPdfImageList([
        {
          id: `${file.name}-${Date.now()}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl: objectUrl,
          width: w,
          height: h,
          rotation: 0,
        },
      ]);

      // Calculate dynamic compression boundaries based on actual file
      const originalSize = file.size;
      const calculatedMin = Math.max(25 * 1024, Math.round(originalSize * 0.04));
      const calculatedMax = Math.max(calculatedMin + 20 * 1024, Math.round(originalSize * 0.9));
      setMinOutputBytes(calculatedMin);
      setMaxOutputBytes(calculatedMax);
      setCompressionSliderVal(40); // default to balanced ~40%
      setIsMaxCompression(false);

      // Reset filters
      setBrightness(0);
      setContrast(1);
      setSaturation(1);
      setIsGrayscale(false);
      setIsSepia(false);
      setIsInvert(false);
      setIsDocScan(false);

      setProcState({ isProcessing: false, stepMessage: '', progressPercent: 100, error: null });
    } catch (err: any) {
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Failed to load image file.',
      });
    }
  }, []);

  // Handle Drag & Drop / File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLoadNewFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLoadNewFile(e.dataTransfer.files[0]);
    }
  };

  // Redraw preview canvas when filters/tools change
  const renderCanvasPreview = useCallback(async () => {
    if (!activeDataUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = await loadImage(activeDataUrl);
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    // Apply CSS filters on context
    ctx.filter = `brightness(${100 + brightness}%) contrast(${contrast * 100}%) saturate(${saturation * 100}%) ${
      isGrayscale ? 'grayscale(100%)' : ''
    } ${isSepia ? 'sepia(100%)' : ''} ${isInvert ? 'invert(100%)' : ''}`;

    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    // Apply Document Scan enhancement if toggled
    if (isDocScan) {
      enhanceScanData(ctx, canvas.width, canvas.height, isGrayscale);
    }
  }, [activeDataUrl, brightness, contrast, saturation, isGrayscale, isSepia, isInvert, isDocScan]);

  useEffect(() => {
    if (activeTab === 'edit' && activeDataUrl) {
      renderCanvasPreview();
    }
  }, [activeTab, activeDataUrl, renderCanvasPreview]);

  // Apply edits and commit to history
  const commitCanvasToHistory = async (customCanvas?: HTMLCanvasElement) => {
    const canvas = customCanvas || canvasRef.current;
    if (!canvas || !activeFile) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const newUrl = URL.createObjectURL(blob);
      const updatedHistory = historyStack.slice(0, historyIndex + 1);
      updatedHistory.push(newUrl);

      setHistoryStack(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
      setActiveDataUrl(newUrl);

      // Create new File representation
      const updatedFile = new File([blob], activeFile.name, { type: blob.type });
      setActiveFile(updatedFile);
      setImageDims({ width: canvas.width, height: canvas.height });
      setResizeWidth(canvas.width);
      setResizeHeight(canvas.height);

      // Reset filters since they are now baked into canvas
      setBrightness(0);
      setContrast(1);
      setSaturation(1);
      setIsGrayscale(false);
      setIsSepia(false);
      setIsInvert(false);
      setIsDocScan(false);
    }, 'image/png');
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevUrl = historyStack[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setActiveDataUrl(prevUrl);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextUrl = historyStack[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setActiveDataUrl(nextUrl);
    }
  };

  // Reset to original upload
  const handleResetEdits = () => {
    if (historyStack.length > 0) {
      const origUrl = historyStack[0];
      setHistoryIndex(0);
      setActiveDataUrl(origUrl);
      setBrightness(0);
      setContrast(1);
      setSaturation(1);
      setIsGrayscale(false);
      setIsSepia(false);
      setIsInvert(false);
      setIsDocScan(false);
    }
  };

  // Crop from dedicated interactive modal
  const handleApplyCropFromModal = async (croppedFile: File, croppedUrl: string) => {
    try {
      const img = await loadImage(croppedUrl);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      setImageDims({ width: w, height: h });
      setResizeWidth(w);
      setResizeHeight(h);
      setActiveFile(croppedFile);
      setActiveDataUrl(croppedUrl);

      const updatedHistory = historyStack.slice(0, historyIndex + 1);
      updatedHistory.push(croppedUrl);
      setHistoryStack(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
    } catch (err) {
      console.error('Error applying crop:', err);
    }
  };

  // Rotate & Flip actions
  const handleRotate = async (degrees: number) => {
    if (!activeDataUrl || !activeFile) return;
    const img = await loadImage(activeDataUrl);
    const canvas = document.createElement('canvas');
    const is90 = Math.abs(degrees) === 90 || Math.abs(degrees) === 270;

    canvas.width = is90 ? img.naturalHeight : img.naturalWidth;
    canvas.height = is90 ? img.naturalWidth : img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    commitCanvasToHistory(canvas);
  };

  const handleFlip = async (horizontal: boolean) => {
    if (!activeDataUrl || !activeFile) return;
    const img = await loadImage(activeDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (horizontal) {
      ctx.scale(-1, 1);
      ctx.drawImage(img, -canvas.width, 0);
    } else {
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, -canvas.height);
    }
    ctx.restore();

    commitCanvasToHistory(canvas);
  };

  // Resize action
  const handleApplyResize = async () => {
    if (!activeDataUrl || resizeWidth <= 0 || resizeHeight <= 0) return;
    const img = await loadImage(activeDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = resizeWidth;
    canvas.height = resizeHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, resizeWidth, resizeHeight);

    commitCanvasToHistory(canvas);
  };

  // Text overlay
  const handleApplyText = async () => {
    if (!overlayText.trim() || !activeDataUrl) return;
    const img = await loadImage(activeDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);
    ctx.font = `bold ${textSize}px sans-serif`;
    ctx.fillStyle = textColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Place text at bottom center
    const textMetrics = ctx.measureText(overlayText);
    const x = Math.max(20, (canvas.width - textMetrics.width) / 2);
    const y = canvas.height - 40;

    ctx.fillText(overlayText, x, y);
    setOverlayText('');
    commitCanvasToHistory(canvas);
  };

  // Drawing event handlers on canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !canvasRef.current) return;
    isMouseDownRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    lastCoordRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMouseDownRef.current || !isDrawingMode || !canvasRef.current || !lastCoordRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const curX = (e.clientX - rect.left) * scaleX;
    const curY = (e.clientY - rect.top) * scaleY;

    ctx.beginPath();
    ctx.moveTo(lastCoordRef.current.x, lastCoordRef.current.y);
    ctx.lineTo(curX, curY);
    ctx.strokeStyle = isEraser ? '#ffffff' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastCoordRef.current = { x: curX, y: curY };
  };

  const handleCanvasMouseUp = () => {
    if (isMouseDownRef.current && isDrawingMode) {
      isMouseDownRef.current = false;
      lastCoordRef.current = null;
      commitCanvasToHistory();
    }
  };

  // MULTI-IMAGE PDF ADDITION
  const handleAddMoreImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files) as File[];
    const newItems: ImageFileItem[] = fileList.map((f: File) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      previewUrl: URL.createObjectURL(f),
      rotation: 0,
    }));
    setPdfImageList((prev) => [...prev, ...newItems]);
  };

  const handleRemovePdfImage = (index: number) => {
    setPdfImageList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMovePdfImage = (index: number, direction: 'up' | 'down') => {
    setPdfImageList((prev) => {
      const copy = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // ==========================================
  // CONVERT WORKFLOW
  // ==========================================
  const handleRunConvert = async () => {
    if (!activeFile || !activeDataUrl) return;

    try {
      setProcState({
        isProcessing: true,
        stepMessage: targetFormat === 'pdf' ? 'Generating PDF Document...' : `Converting to ${targetFormat.toUpperCase()}...`,
        progressPercent: 30,
        error: null,
      });

      if (targetFormat === 'pdf') {
        // Multi-image or single image to PDF
        const pdfDoc = await PDFDocument.create();
        const imagesToProcess = pdfImageList.length > 0 ? pdfImageList : [{
          id: '1',
          file: activeFile,
          name: activeFile.name,
          size: activeFile.size,
          type: activeFile.type,
          previewUrl: activeDataUrl,
          rotation: 0,
        }];

        for (let i = 0; i < imagesToProcess.length; i++) {
          setProcState({
            isProcessing: true,
            stepMessage: `Embedding page ${i + 1} of ${imagesToProcess.length}...`,
            progressPercent: Math.round(((i + 1) / imagesToProcess.length) * 80),
            error: null,
          });

          const item = imagesToProcess[i];
          // Use convertImageFormat to get clean JPEG bytes (and optional document scan enhance)
          const converted = await convertImageFormat(item.file, 'jpeg', 0.9, {
            enhanceScan: pdfDocScanMode,
          });
          const imgBytes = await converted.blob.arrayBuffer();
          const embeddedImage = await pdfDoc.embedJpg(imgBytes);

          // Page dimensions
          let pageWidth = 595.28; // A4 pt
          let pageHeight = 841.89;
          if (pdfPageSize === 'letter') {
            pageWidth = 612;
            pageHeight = 792;
          } else if (pdfPageSize === 'original') {
            pageWidth = converted.width;
            pageHeight = converted.height;
          }

          const page = pdfDoc.addPage([pageWidth, pageHeight]);
          const margin = pdfMargin;
          const availWidth = pageWidth - margin * 2;
          const availHeight = pageHeight - margin * 2;

          const imgRatio = converted.width / converted.height;
          let drawWidth = availWidth;
          let drawHeight = availWidth / imgRatio;

          if (drawHeight > availHeight) {
            drawHeight = availHeight;
            drawWidth = availHeight * imgRatio;
          }

          const x = margin + (availWidth - drawWidth) / 2;
          const y = margin + (availHeight - drawHeight) / 2;

          page.drawImage(embeddedImage, {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
          });
        }

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const originalTotalSize = imagesToProcess.reduce((sum, item) => sum + item.size, 0);
        const outName = activeFile.name.replace(/\.[^/.]+$/, '') + '.pdf';

        setConversionResult({
          blob: pdfBlob,
          url: pdfUrl,
          filename: outName,
          originalSize: originalTotalSize,
          finalSize: pdfBlob.size,
          format: 'PDF',
          compressionRatio: Math.max(0, Math.round(((originalTotalSize - pdfBlob.size) / originalTotalSize) * 100)),
          pageCount: imagesToProcess.length,
        });
      } else {
        // Standard Image Format Conversion (JPG, PNG, WEBP)
        const formatQuality = targetFormat === 'png' ? 1.0 : 0.92;
        const res = await convertImageFormat(activeFile, targetFormat, formatQuality);
        const outName = activeFile.name.replace(/\.[^/.]+$/, '') + `.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}`;
        const outUrl = URL.createObjectURL(res.blob);

        setConversionResult({
          blob: res.blob,
          url: outUrl,
          filename: outName,
          originalSize: activeFile.size,
          finalSize: res.blob.size,
          format: targetFormat.toUpperCase(),
          compressionRatio: Math.max(0, Math.round(((activeFile.size - res.blob.size) / activeFile.size) * 100)),
          width: res.width,
          height: res.height,
          previewUrl: outUrl,
        });
      }

      setProcState({ isProcessing: false, stepMessage: '', progressPercent: 100, error: null });
      triggerSuccessCelebration();
    } catch (err: any) {
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Conversion failed. Please try again.',
      });
    }
  };

  // ==========================================
  // COMPRESS WORKFLOW
  // ==========================================
  const estimatedTargetBytes = Math.round(
    minOutputBytes + ((100 - compressionSliderVal) / 100) * (maxOutputBytes - minOutputBytes)
  );

  const handleRunCompress = async () => {
    if (!activeFile) return;

    try {
      setProcState({
        isProcessing: true,
        stepMessage: isMaxCompression ? 'Running maximum compression optimizer...' : 'Compressing image to target size...',
        progressPercent: 20,
        error: null,
      });

      const targetBytes = isMaxCompression ? minOutputBytes : estimatedTargetBytes;
      const res = await compressImageToTargetSize(activeFile, targetBytes, (msg, pct) => {
        setProcState((prev) => ({ ...prev, stepMessage: msg, progressPercent: pct }));
      });

      const outName = activeFile.name.replace(/\.[^/.]+$/, '') + '-compressed.jpg';
      const outUrl = URL.createObjectURL(res.blob);
      const ratio = Math.max(0, Math.round(((activeFile.size - res.finalSize) / activeFile.size) * 1000) / 10);

      setConversionResult({
        blob: res.blob,
        url: outUrl,
        filename: outName,
        originalSize: activeFile.size,
        finalSize: res.finalSize,
        format: 'JPG (Compressed)',
        compressionRatio: ratio,
        width: res.width,
        height: res.height,
        previewUrl: outUrl,
      });

      setProcState({ isProcessing: false, stepMessage: '', progressPercent: 100, error: null });
      triggerSuccessCelebration();
    } catch (err: any) {
      setProcState({
        isProcessing: false,
        stepMessage: '',
        progressPercent: 0,
        error: err.message || 'Compression failed. Please try again.',
      });
    }
  };

  // Trigger subtle celebration
  const triggerSuccessCelebration = () => {
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#4f46e5', '#059669', '#3b82f6'],
        disableForReducedMotion: true,
      });
    } catch {
      // Ignore
    }
  };

  // Start New File (reset workspace)
  const handleStartNew = () => {
    setActiveFile(null);
    setActiveDataUrl(null);
    setConversionResult(null);
    setHistoryStack([]);
    setHistoryIndex(-1);
    setPdfImageList([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Keep working with active image
  const handleContinueWorking = () => {
    setConversionResult(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Top Banner Ad Slot */}
      <AdSlot position="header" onOpenAdmin={onOpenAdmin} />

      {/* ========================================================================= */}
      {/* 1. INITIAL UPLOAD / CAMERA SELECTION (WHEN NO FILE IS LOADED) */}
      {/* ========================================================================= */}
      {!activeFile && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Minimal, direct prompt */}
          <div className="text-center space-y-2 py-4">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-['Outfit']">
              Fast, Private File Workspace
            </h1>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Choose a photo or take a picture to edit, convert, or compress instantly in your browser.
            </p>
          </div>

          {/* Dual Action Upload & Camera Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Choose Image Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="p-8 rounded-3xl bg-white border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-center flex flex-col items-center justify-center space-y-4 cursor-pointer shadow-xs group"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Upload Image
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Choose file or drag & drop (JPG, PNG, WEBP)
                </p>
              </div>
              <span className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xs">
                Browse Files
              </span>
            </div>

            {/* Take Photo Box */}
            <div
              onClick={() => setIsCameraOpen(true)}
              className="p-8 rounded-3xl bg-white border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-center flex flex-col items-center justify-center space-y-4 cursor-pointer shadow-xs group"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                <Camera className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Take Photo
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Open device camera with flash & flip
                </p>
              </div>
              <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xs">
                Open Camera
              </span>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Quick Specialist Tools Showcase Grid */}
          <div className="pt-4 max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Popular Specialty Tools
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Passport Photo */}
              <div
                onClick={() => onSelectTool && onSelectTool('passport-photo')}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                      Passport Size Photo
                    </h3>
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded shrink-0">
                      New
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Print sheet, background & 50KB–2MB
                  </p>
                </div>
              </div>

              {/* Signature Maker */}
              <div
                onClick={() => onSelectTool && onSelectTool('signature-maker')}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-purple-500 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition-transform shrink-0">
                  <PenTool className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-900 group-hover:text-purple-600 transition-colors truncate">
                      Signature Maker
                    </h3>
                    <span className="text-[9px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.2 rounded shrink-0">
                      New
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Draw or upload • 15KB–50KB target
                  </p>
                </div>
              </div>

              {/* PDF Compressor */}
              <div
                onClick={() => onSelectTool && onSelectTool('pdf-compressor')}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-500 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate">
                    Compress PDF
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Dual-engine slider & password unlock
                  </p>
                </div>
              </div>

              {/* Images to PDF */}
              <div
                onClick={() => onSelectTool && onSelectTool('image-to-pdf')}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition-transform shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                    Images to PDF
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Batch convert, crop & reorder pages
                  </p>
                </div>
              </div>

              {/* PDF to Image */}
              <div
                onClick={() => onSelectTool && onSelectTool('pdf-to-image')}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    PDF to JPG / PNG
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Extract all pages or custom ZIP
                  </p>
                </div>
              </div>

              {/* Camera Scanner */}
              <div
                onClick={() => setIsCameraOpen(true)}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                    Camera Scanner
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Snap documents & enhance clarity
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED WORKSPACE (ONCE FILE IS ACTIVE) */}
      {/* ========================================================================= */}
      {activeFile && activeDataUrl && !conversionResult && (
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-6 shadow-xs animate-in fade-in duration-200">
          
          {/* Top Bar: File Info + Change Photo */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {activeFile.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {imageDims.width > 0 ? `${imageDims.width}×${imageDims.height} • ` : ''}
                  {formatBytes(activeFile.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsCropModalOpen(true)}
                className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Crop & Trim Image"
              >
                <CropIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Crop</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Retake with Camera"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Camera</span>
              </button>

              <button
                type="button"
                onClick={handleStartNew}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Choose different file"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">New File</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SMART SEGMENTED CONTROL: [ Edit ] [ Convert ] [ Compress ] */}
          {/* ========================================================================= */}
          <div className="flex p-1 rounded-2xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('convert')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'convert'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              Convert
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compress')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'compress'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Minimize2 className="w-4 h-4" />
              Compress
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white text-purple-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Edit
            </button>
          </div>

          {/* Main Visual Display & Controls Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left/Center: Large Image Preview */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[300px] sm:min-h-[380px] overflow-hidden relative">
              {activeTab === 'edit' ? (
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-xs cursor-crosshair"
                />
              ) : (
                <img
                  src={activeDataUrl}
                  alt={activeFile.name}
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-xs"
                />
              )}

              {/* History Undo / Redo buttons inside preview when in Edit mode */}
              {activeTab === 'edit' && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1.5 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-30 cursor-pointer"
                    title="Undo"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= historyStack.length - 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 disabled:opacity-30 cursor-pointer"
                    title="Redo"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetEdits}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-rose-600 cursor-pointer"
                    title="Reset All Edits"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Side: Tab Specific Controls */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              
              {/* ===================================================== */}
              {/* TAB 1: CONVERT CONTROLS */}
              {/* ===================================================== */}
              {activeTab === 'convert' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Output Format
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['jpeg', 'png', 'webp', 'pdf'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setTargetFormat(fmt)}
                          className={`py-3 rounded-xl border text-center font-bold text-xs uppercase transition-all cursor-pointer ${
                            targetFormat === fmt
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {fmt === 'jpeg' ? 'JPG' : fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* If PDF format is chosen */}
                  {targetFormat === 'pdf' ? (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-900">Document / Scan Mode</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={pdfDocScanMode}
                          onChange={(e) => setPdfDocScanMode(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Automatically cleans background shadows and deepens ink for paper photos.
                      </p>

                      {/* Multi Image List Strip */}
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
                          <span>Pages in PDF ({pdfImageList.length}):</span>
                          <button
                            type="button"
                            onClick={() => additionalImagesInputRef.current?.click()}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:underline cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Images
                          </button>
                        </div>

                        <input
                          ref={additionalImagesInputRef}
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleAddMoreImages}
                          className="hidden"
                        />

                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {pdfImageList.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono text-slate-400">#{idx + 1}</span>
                                <span className="font-medium text-slate-800 truncate max-w-[120px]">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMovePdfImage(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMovePdfImage(idx, 'down')}
                                  disabled={idx === pdfImageList.length - 1}
                                  className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-20 cursor-pointer"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                {pdfImageList.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePdfImage(idx)}
                                    className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                      <span className="text-xs font-semibold text-slate-700">Format Summary:</span>
                      <p className="text-[11px] text-slate-500">
                        {targetFormat === 'jpeg' && 'Standard JPG format, universal compatibility across all devices and web platforms.'}
                        {targetFormat === 'png' && 'Lossless PNG format with full transparency support.'}
                        {targetFormat === 'webp' && 'Modern lightweight WebP format for fast web delivery.'}
                      </p>
                    </div>
                  )}

                  {/* Primary Convert Button */}
                  <button
                    type="button"
                    onClick={handleRunConvert}
                    disabled={procState.isProcessing}
                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-5 h-5" />
                    {targetFormat === 'pdf' ? 'Create PDF Document' : `Convert to ${targetFormat.toUpperCase()}`}
                  </button>
                </div>
              )}

              {/* ===================================================== */}
              {/* TAB 2: COMPRESS CONTROLS */}
              {/* ===================================================== */}
              {activeTab === 'compress' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Target Compression
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {isMaxCompression ? 'Smallest Possible' : `~${formatBytes(estimatedTargetBytes)}`}
                      </span>
                    </div>

                    {/* Dynamic Slider */}
                    <div className="space-y-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        disabled={isMaxCompression}
                        value={compressionSliderVal}
                        onChange={(e) => {
                          setCompressionSliderVal(parseInt(e.target.value));
                          setIsMaxCompression(false);
                        }}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 disabled:opacity-40"
                      />
                      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                        <span>Min (~{formatBytes(minOutputBytes)})</span>
                        <span>Max (~{formatBytes(maxOutputBytes)})</span>
                      </div>
                    </div>

                    {/* Maximum Compression Toggle */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Maximum Compression</span>
                        <span className="text-[11px] text-slate-500">Auto-search smallest usable size</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMaxCompression(!isMaxCompression)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isMaxCompression
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {isMaxCompression ? 'Enabled' : 'Enable'}
                      </button>
                    </div>
                  </div>

                  {/* Size Comparison Card */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase">Original</span>
                      <p className="text-sm font-bold text-slate-800 font-mono">{formatBytes(activeFile.size)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 uppercase">Estimated</span>
                      <p className="text-sm font-bold text-emerald-700 font-mono">
                        {isMaxCompression ? formatBytes(minOutputBytes) : formatBytes(estimatedTargetBytes)}
                      </p>
                    </div>
                  </div>

                  {/* Primary Compress Button */}
                  <button
                    type="button"
                    onClick={handleRunCompress}
                    disabled={procState.isProcessing}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Minimize2 className="w-5 h-5" />
                    Compress Image Now
                  </button>
                </div>
              )}

              {/* ===================================================== */}
              {/* TAB 3: EDIT CONTROLS */}
              {/* ===================================================== */}
              {activeTab === 'edit' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  
                  {/* Mobile-first Sub-tools horizontal toolbar */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {[
                      { id: 'crop', label: 'Crop', icon: CropIcon },
                      { id: 'adjust', label: 'Filters', icon: Sliders },
                      { id: 'rotate', label: 'Rotate/Flip', icon: RotateCw },
                      { id: 'resize', label: 'Resize', icon: Maximize2 },
                      { id: 'draw', label: 'Draw', icon: Pencil },
                      { id: 'text', label: 'Text', icon: Type },
                    ].map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => {
                            if (tool.id === 'crop') {
                              setIsCropModalOpen(true);
                              return;
                            }
                            setActiveEditTool(tool.id as EditSubTool);
                            setIsDrawingMode(tool.id === 'draw');
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                            activeEditTool === tool.id
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {tool.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sub-tool panels */}
                  {activeEditTool === 'adjust' && (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span>Brightness:</span>
                          <span className="font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          value={brightness}
                          onChange={(e) => setBrightness(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-slate-700 mb-1">
                          <span>Contrast:</span>
                          <span className="font-mono">{Math.round(contrast * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.1"
                          value={contrast}
                          onChange={(e) => setContrast(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsGrayscale(!isGrayscale)}
                          className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isGrayscale ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          B&W
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSepia(!isSepia)}
                          className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isSepia ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          Sepia
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDocScan(!isDocScan)}
                          className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isDocScan ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          Scan Clean
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => commitCanvasToHistory()}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        Apply Filters to Image
                      </button>
                    </div>
                  )}

                  {activeEditTool === 'rotate' && (
                    <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleRotate(90)}
                        className="py-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <RotateCw className="w-4 h-4 text-purple-600" /> Rotate 90°
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotate(180)}
                        className="py-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <RotateCw className="w-4 h-4 text-purple-600" /> Rotate 180°
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlip(true)}
                        className="py-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <FlipHorizontal className="w-4 h-4 text-purple-600" /> Flip Horizontal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlip(false)}
                        className="py-3 rounded-xl bg-white border border-slate-200 hover:border-purple-300 text-xs font-bold text-slate-800 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <FlipVertical className="w-4 h-4 text-purple-600" /> Flip Vertical
                      </button>
                    </div>
                  )}

                  {activeEditTool === 'resize' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Width (px)</label>
                          <input
                            type="number"
                            value={resizeWidth}
                            onChange={(e) => {
                              const w = parseInt(e.target.value) || 0;
                              setResizeWidth(w);
                              if (maintainAspect && imageDims.width > 0) {
                                setResizeHeight(Math.round((w / imageDims.width) * imageDims.height));
                              }
                            }}
                            className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Height (px)</label>
                          <input
                            type="number"
                            value={resizeHeight}
                            onChange={(e) => {
                              const h = parseInt(e.target.value) || 0;
                              setResizeHeight(h);
                              if (maintainAspect && imageDims.height > 0) {
                                setResizeWidth(Math.round((h / imageDims.height) * imageDims.width));
                              }
                            }}
                            className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyResize}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        Apply New Dimensions
                      </button>
                    </div>
                  )}

                  {activeEditTool === 'draw' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Brush Color:</span>
                        <input
                          type="color"
                          value={brushColor}
                          onChange={(e) => setBrushColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-700 mb-1 block">Brush Size: {brushSize}px</span>
                        <input
                          type="range"
                          min="1"
                          max="40"
                          value={brushSize}
                          onChange={(e) => setBrushSize(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Draw directly over the preview image above using your mouse or touchscreen.
                      </p>
                    </div>
                  )}

                  {activeEditTool === 'text' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <input
                        type="text"
                        value={overlayText}
                        onChange={(e) => setOverlayText(e.target.value)}
                        placeholder="Type text to overlay..."
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Text Color:</span>
                        <input
                          type="color"
                          value={textColor}
                          onChange={(e) => setTextColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyText}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        Add Text to Image
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* In-progress progress bar */}
              <ProgressBar
                isProcessing={procState.isProcessing}
                stepMessage={procState.stepMessage}
                progressPercent={procState.progressPercent}
              />

              {procState.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                  {procState.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. RESULT & DOWNLOAD AREA */}
      {/* ========================================================================= */}
      {conversionResult && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in zoom-in-95 duration-200">
          
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Ready to Download</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-['Outfit']">
                  Processing Complete
                </h2>
              </div>
            </div>
          </div>

          {/* Metrics Comparison Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 uppercase">Original</span>
              <p className="text-base font-bold text-slate-800 mt-1 font-mono">
                {formatBytes(conversionResult.originalSize)}
              </p>
            </div>
            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
              <span className="text-[11px] font-medium text-emerald-800 uppercase">Output</span>
              <p className="text-base font-bold text-emerald-700 mt-1 font-mono">
                {formatBytes(conversionResult.finalSize)}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 uppercase">Format</span>
              <p className="text-base font-bold text-slate-900 mt-1 font-mono uppercase">
                {conversionResult.format}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 uppercase">Saved</span>
              <p className="text-base font-bold text-indigo-600 mt-1 font-mono">
                {conversionResult.compressionRatio > 0 ? `-${conversionResult.compressionRatio}%` : 'Optimal'}
              </p>
            </div>
          </div>

          {/* Result Output Preview */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex items-center justify-center min-h-[220px] max-h-[340px] overflow-hidden">
            {conversionResult.previewUrl ? (
              <img
                src={conversionResult.previewUrl}
                alt={conversionResult.filename}
                className="max-h-[320px] max-w-full object-contain rounded-lg shadow-xs"
              />
            ) : (
              <div className="text-center space-y-2">
                <FileCheck className="w-14 h-14 text-rose-500 mx-auto" />
                <p className="text-sm font-bold text-slate-900">{conversionResult.filename}</p>
                <p className="text-xs text-slate-500">PDF Document Ready</p>
              </div>
            )}
          </div>

          {/* Result Ad Slot */}
          <AdSlot position="before-download" onOpenAdmin={onOpenAdmin} />

          {/* Single Unified Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => triggerDownload(conversionResult.blob, conversionResult.filename)}
              className="w-full sm:flex-1 py-4 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base sm:text-lg shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <Download className="w-6 h-6" />
              Download ({formatBytes(conversionResult.finalSize)})
            </button>

            <button
              type="button"
              onClick={handleContinueWorking}
              className="w-full sm:w-auto px-5 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors border border-slate-200 cursor-pointer"
            >
              Continue Working
            </button>

            <button
              type="button"
              onClick={handleStartNew}
              className="w-full sm:w-auto px-5 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors border border-slate-200 cursor-pointer"
            >
              Start New
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureSingle={(file) => handleLoadNewFile(file)}
        onCaptureBatch={(files) => {
          if (files.length > 0) {
            handleLoadNewFile(files[0]);
            if (files.length > 1) {
              const extraItems: ImageFileItem[] = files.slice(1).map((f) => ({
                id: `${f.name}-${Date.now()}-${Math.random()}`,
                file: f,
                name: f.name,
                size: f.size,
                type: f.type,
                previewUrl: URL.createObjectURL(f),
                rotation: 0,
              }));
              setPdfImageList((prev) => [...prev, ...extraItems]);
            }
          }
        }}
        onCreatePdfDirectly={(pdfBlob, filename, count) => {
          const url = URL.createObjectURL(pdfBlob);
          setConversionResult({
            blob: pdfBlob,
            url,
            filename,
            originalSize: pdfBlob.size,
            finalSize: pdfBlob.size,
            format: 'PDF Document',
            compressionRatio: 0,
            pageCount: count,
          });
          triggerSuccessCelebration();
        }}
      />

      {/* Interactive Image Crop Modal */}
      {isCropModalOpen && activeDataUrl && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={activeDataUrl}
          imageName={activeFile?.name || 'image.jpg'}
          onClose={() => setIsCropModalOpen(false)}
          onApplyCrop={handleApplyCropFromModal}
        />
      )}
    </div>
  );
};
