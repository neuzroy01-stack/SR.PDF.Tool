import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  SwitchCamera,
  Zap,
  ZapOff,
  X,
  Check,
  RotateCcw,
  RotateCw,
  Crop as CropIcon,
  Trash2,
  Plus,
  ArrowRight,
  FileText,
  AlertCircle,
  Sparkles,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import { ImageFileItem } from '../types';
import { imagesToPdf } from '../services/pdfService';
import { formatBytes } from '../services/imageService';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureSingle?: (file: File) => void;
  onCaptureBatch?: (files: File[]) => void;
  onCreatePdfDirectly?: (pdfBlob: Blob, filename: string, pageCount: number) => void;
}

interface CapturedPhotoItem {
  id: string;
  file: File;
  dataUrl: string;
  rotation: number;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCaptureSingle,
  onCaptureBatch,
  onCreatePdfDirectly,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchMode, setTorchMode] = useState<'off' | 'on' | 'auto'>('off');

  // Mode: 'live' | 'preview_single' | 'gallery_review' | 'pdf_settings'
  const [screenMode, setScreenMode] = useState<'live' | 'preview_single' | 'gallery_review' | 'pdf_settings'>('live');
  const [currentSinglePhoto, setCurrentSinglePhoto] = useState<CapturedPhotoItem | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhotoItem[]>([]);

  // Crop Modal state
  const [croppingPhotoIndex, setCroppingPhotoIndex] = useState<number | null>(null);

  // PDF Generation options inside camera flow
  const [pdfQualitySlider, setPdfQualitySlider] = useState<number>(75); // 0 (min) to 100 (max)
  const [docScanClean, setDocScanClean] = useState<boolean>(true);
  const [customPdfName, setCustomPdfName] = useState<string>('scanned_document');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfGenProgress, setPdfGenProgress] = useState<number>(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Stop camera tracks helper
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    stopTracks();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser.');
      }

      // Check available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);

      // Request stream
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Inspect torch/flash capabilities
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as { torch?: boolean };
        setHasTorch(Boolean(capabilities.torch));
      } else {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please grant camera permission in your browser or device settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera hardware was detected on your device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErrorMessage('Camera is in use by another application or browser tab.');
      } else {
        setErrorMessage(err.message || 'Unable to access camera.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, stopTracks]);

  // Lifecycle effect
  useEffect(() => {
    if (isOpen && screenMode === 'live') {
      startCamera();
    } else {
      stopTracks();
    }

    return () => {
      stopTracks();
    };
  }, [isOpen, screenMode, startCamera, stopTracks]);

  // Reset all states when modal closed
  const handleCloseAll = () => {
    stopTracks();
    setCapturedPhotos([]);
    setCurrentSinglePhoto(null);
    setScreenMode('live');
    setErrorMessage(null);
    onClose();
  };

  // Toggle Torch/Flash
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextMode = torchMode === 'off' ? 'on' : torchMode === 'on' ? 'auto' : 'off';
      const isTorchActive = nextMode === 'on';

      await (track as any).applyConstraints({
        advanced: [{ torch: isTorchActive }],
      });
      setTorchMode(nextMode);
    } catch (err) {
      console.warn('Torch not supported or failed to toggle:', err);
      setHasTorch(false);
    }
  };

  // Switch between front & back camera
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Snap photo
  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, mirror horizontally
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const file = new File([blob], `capture-${timestamp}.jpg`, { type: 'image/jpeg' });

        const photoItem: CapturedPhotoItem = {
          id: `photo-${Date.now()}-${Math.random()}`,
          file,
          dataUrl,
          rotation: 0,
        };

        setCurrentSinglePhoto(photoItem);
        setScreenMode('preview_single');
        stopTracks();
      },
      'image/jpeg',
      0.95
    );
  };

  // Retake current single photo
  const handleRetakeSingle = () => {
    setCurrentSinglePhoto(null);
    setScreenMode('live');
  };

  // Rotate single photo in preview
  const handleRotateSingle = () => {
    if (!currentSinglePhoto) return;
    setCurrentSinglePhoto({
      ...currentSinglePhoto,
      rotation: (currentSinglePhoto.rotation + 90) % 360,
    });
  };

  // Accept current single photo
  const handleAcceptSinglePhoto = (openAddMore: boolean = false) => {
    if (!currentSinglePhoto) return;

    const updatedList = [...capturedPhotos, currentSinglePhoto];
    setCapturedPhotos(updatedList);
    setCurrentSinglePhoto(null);

    if (openAddMore) {
      setScreenMode('live');
    } else {
      setScreenMode('gallery_review');
    }
  };

  // Rotate photo in gallery
  const handleRotateInGallery = (index: number) => {
    setCapturedPhotos((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, rotation: (item.rotation + 90) % 360 } : item
      )
    );
  };

  // Delete photo in gallery
  const handleDeleteInGallery = (index: number) => {
    setCapturedPhotos((prev) => prev.filter((_, idx) => idx !== index));
    if (capturedPhotos.length <= 1) {
      setScreenMode('live');
    }
  };

  // Apply crop result
  const handleApplyCroppedImage = (croppedFile: File, croppedDataUrl: string) => {
    if (croppingPhotoIndex === -1 && currentSinglePhoto) {
      // Cropping current single photo
      setCurrentSinglePhoto({
        ...currentSinglePhoto,
        file: croppedFile,
        dataUrl: croppedDataUrl,
      });
    } else if (croppingPhotoIndex !== null && croppingPhotoIndex >= 0) {
      // Cropping in gallery
      setCapturedPhotos((prev) =>
        prev.map((item, idx) =>
          idx === croppingPhotoIndex
            ? { ...item, file: croppedFile, dataUrl: croppedDataUrl }
            : item
        )
      );
    }
    setCroppingPhotoIndex(null);
  };

  // Send captured files to parent directly
  const handleUsePhotosAsImages = () => {
    const files = capturedPhotos.map((p) => p.file);
    if (files.length === 1 && onCaptureSingle) {
      onCaptureSingle(files[0]);
    } else if (onCaptureBatch) {
      onCaptureBatch(files);
    } else if (onCaptureSingle && files.length > 0) {
      onCaptureSingle(files[0]);
    }
    handleCloseAll();
  };

  // Calculate dynamic estimated PDF size
  const totalImageBytes = capturedPhotos.reduce((acc, p) => acc + p.file.size, 0);
  const qualityFactor = pdfQualitySlider / 100;
  // Estimated size range
  const estMinBytes = Math.round(totalImageBytes * 0.15 * Math.max(0.4, qualityFactor));
  const estMaxBytes = Math.round(totalImageBytes * 0.70 * Math.max(0.6, qualityFactor));

  // Generate PDF directly from captured photos
  const handleGeneratePdfNow = async () => {
    if (capturedPhotos.length === 0) return;

    setIsGeneratingPdf(true);
    setPdfGenProgress(15);

    try {
      const imageItems: ImageFileItem[] = capturedPhotos.map((p) => ({
        id: p.id,
        file: p.file,
        name: p.file.name,
        size: p.file.size,
        type: p.file.type,
        previewUrl: p.dataUrl,
        rotation: p.rotation,
        enhanceScan: docScanClean,
      }));

      const pdfBlob = await imagesToPdf(
        imageItems,
        {
          pageSize: 'a4',
          orientation: 'portrait',
          margin: 'normal',
          documentScanAll: docScanClean,
          qualityLevel: pdfQualitySlider,
        },
        (_msg, pct) => {
          setPdfGenProgress(pct);
        }
      );

      const cleanBase = customPdfName.trim() || `scanned_document_${capturedPhotos.length}_pages`;
      const filename = cleanBase.endsWith('.pdf') ? cleanBase : `${cleanBase}.pdf`;

      if (onCreatePdfDirectly) {
        onCreatePdfDirectly(pdfBlob, filename, capturedPhotos.length);
      } else {
        // Fallback auto download
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      handleCloseAll();
    } catch (err: any) {
      console.error('Camera PDF generation error:', err);
      setErrorMessage(err.message || 'Failed to generate PDF from camera photos.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[94dvh] max-h-[850px]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800 text-white z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm sm:text-base font-['Outfit']">
              {screenMode === 'live' && 'Camera Document Scanner'}
              {screenMode === 'preview_single' && 'Review Photo'}
              {screenMode === 'gallery_review' && `Captured Pages (${capturedPhotos.length})`}
              {screenMode === 'pdf_settings' && 'Create PDF from Camera'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCloseAll}
            className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Body Content */}
        <div className="relative flex-1 bg-black flex flex-col items-center justify-center overflow-hidden min-h-0">
          
          {/* Error View */}
          {errorMessage && (
            <div className="p-6 text-center space-y-4 max-w-md my-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-white font-bold text-base">Camera Notice</h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  startCamera();
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* 1. Live Camera View */}
          {!errorMessage && screenMode === 'live' && (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Viewfinder Guide Overlay */}
              <div className="absolute inset-4 sm:inset-8 border border-white/30 rounded-2xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-2 border-l-2 border-indigo-400 rounded-tl"></div>
                  <div className="w-6 h-6 border-t-2 border-r-2 border-indigo-400 rounded-tr"></div>
                </div>
                <div className="text-center">
                  <span className="bg-black/60 text-white/90 text-[11px] font-medium px-3 py-1 rounded-full backdrop-blur-xs">
                    Align document inside frame
                  </span>
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-2 border-l-2 border-indigo-400 rounded-bl"></div>
                  <div className="w-6 h-6 border-b-2 border-r-2 border-indigo-400 rounded-br"></div>
                </div>
              </div>

              {isLoading && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Initializing Camera...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Single Photo Review View */}
          {!errorMessage && screenMode === 'preview_single' && currentSinglePhoto && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-3">
              <div className="relative max-h-[55vh] flex items-center justify-center overflow-hidden rounded-2xl bg-slate-950 border border-slate-800">
                <img
                  src={currentSinglePhoto.dataUrl}
                  alt="Captured Photo"
                  style={{ transform: `rotate(${currentSinglePhoto.rotation}deg)` }}
                  className="max-h-[52vh] max-w-full object-contain transition-transform duration-200"
                />
              </div>

              {/* Quick Editing Toolbar */}
              <div className="flex items-center gap-2 mt-3 text-xs">
                <button
                  type="button"
                  onClick={handleRotateSingle}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                  Rotate
                </button>
                <button
                  type="button"
                  onClick={() => setCroppingPhotoIndex(-1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <CropIcon className="w-3.5 h-3.5 text-indigo-400" />
                  Crop
                </button>
              </div>
            </div>
          )}

          {/* 3. Gallery Review View (Multi-photo management) */}
          {!errorMessage && screenMode === 'gallery_review' && (
            <div className="w-full h-full p-4 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span>{capturedPhotos.length} {capturedPhotos.length === 1 ? 'Page' : 'Pages'} Captured</span>
                <span>Total: ~{formatBytes(totalImageBytes)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {capturedPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col space-y-2 relative"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">
                        Page {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteInGallery(index)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        title="Delete Page"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="h-32 rounded-xl bg-black overflow-hidden flex items-center justify-center p-1 border border-slate-800">
                      <img
                        src={photo.dataUrl}
                        alt={`Photo ${index + 1}`}
                        style={{ transform: `rotate(${photo.rotation}deg)` }}
                        className="max-h-full max-w-full object-contain rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleRotateInGallery(index)}
                        className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                        title="Rotate Page"
                      >
                        <RotateCw className="w-3 h-3 text-indigo-400" />
                        <span>Rotate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCroppingPhotoIndex(index)}
                        className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                        title="Crop Page"
                      >
                        <CropIcon className="w-3 h-3 text-indigo-400" />
                        <span>Crop</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. PDF Settings View */}
          {!errorMessage && screenMode === 'pdf_settings' && (
            <div className="w-full h-full p-4 sm:p-6 overflow-y-auto space-y-5 text-white">
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-white font-['Outfit']">
                  Configure PDF Quality & File Size
                </h4>
                <p className="text-xs text-slate-400">
                  Ready to compile {capturedPhotos.length} captured photos into a single PDF document.
                </p>
              </div>

              {/* Quality Slider Control */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Target PDF Quality / Size:</span>
                  <span className="text-indigo-400 font-mono font-bold">
                    {pdfQualitySlider < 40 ? 'Smaller Size' : pdfQualitySlider < 70 ? 'Balanced' : 'High Quality'} ({pdfQualitySlider}%)
                  </span>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={pdfQualitySlider}
                    onChange={(e) => setPdfQualitySlider(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Minimum Size</span>
                    <span>Standard</span>
                    <span>Best Quality</span>
                  </div>
                </div>

                {/* Estimated Output Size */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Estimated PDF Size:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    ~{formatBytes(estMinBytes)} – {formatBytes(estMaxBytes)}
                  </span>
                </div>
              </div>

              {/* Document Enhancer toggle */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <div>
                    <h5 className="text-xs font-bold text-white">Smart Document Scanner Mode</h5>
                    <p className="text-[11px] text-slate-400">
                      Cleans paper background and enhances text contrast.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={docScanClean}
                  onChange={(e) => setDocScanClean(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Output File Name Customization */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Output PDF Name (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPdfName}
                    onChange={(e) => setCustomPdfName(e.target.value)}
                    placeholder="scanned_document"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <span className="text-xs font-mono font-bold text-slate-400 px-2.5 py-2 bg-slate-800 rounded-xl">
                    .pdf
                  </span>
                </div>
              </div>

              {/* Progress if generating */}
              {isGeneratingPdf && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2 text-center">
                  <div className="flex items-center justify-center gap-2 text-indigo-300 text-xs font-semibold">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Generating PDF Document ({pdfGenProgress}%)...</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${pdfGenProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 text-white shrink-0">
          
          {/* 1. Live Camera Toolbar */}
          {screenMode === 'live' && !errorMessage && (
            <div className="w-full flex items-center justify-between gap-3">
              {/* Flash / Torch Toggle */}
              <div className="w-16 flex justify-start">
                {hasTorch ? (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      torchMode === 'on'
                        ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/30'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                    title={`Flash mode: ${torchMode}`}
                  >
                    {torchMode === 'on' ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
                  </button>
                ) : (
                  <div className="w-10" />
                )}
              </div>

              {/* Big Capture Shutter Button */}
              <div className="flex-1 flex justify-center">
                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={isLoading}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white hover:bg-slate-100 p-1.5 shadow-xl shadow-white/20 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
                  title="Capture Photo"
                >
                  <div className="w-full h-full rounded-full border-4 border-slate-900 bg-white flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-700 transition-colors"></div>
                  </div>
                </button>
              </div>

              {/* Switch Camera (Front/Rear) */}
              <div className="w-16 flex justify-end">
                {hasMultipleCameras ? (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer"
                    title="Switch Front/Rear Camera"
                  >
                    <SwitchCamera className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="w-10" />
                )}
              </div>
            </div>
          )}

          {/* 2. Single Photo Review Toolbar */}
          {screenMode === 'preview_single' && (
            <div className="w-full flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={handleRetakeSingle}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>

              <button
                type="button"
                onClick={() => handleAcceptSinglePhoto(true)}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700 text-indigo-200 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                + Add More Photos
              </button>

              <button
                type="button"
                onClick={() => handleAcceptSinglePhoto(false)}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Use Photo
              </button>
            </div>
          )}

          {/* 3. Gallery Review Toolbar */}
          {screenMode === 'gallery_review' && (
            <div className="w-full flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => setScreenMode('live')}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                + Capture Another Photo
              </button>

              <button
                type="button"
                onClick={() => setScreenMode('pdf_settings')}
                className="w-full sm:w-auto flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Create PDF ({capturedPhotos.length})
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4. PDF Settings Toolbar */}
          {screenMode === 'pdf_settings' && (
            <div className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScreenMode('gallery_review')}
                disabled={isGeneratingPdf}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleGeneratePdfNow}
                disabled={isGeneratingPdf}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Generate PDF ({capturedPhotos.length} {capturedPhotos.length === 1 ? 'Page' : 'Pages'})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cropping Modal */}
      {croppingPhotoIndex !== null && (
        <ImageCropModal
          isOpen={true}
          imageSrc={
            croppingPhotoIndex === -1 && currentSinglePhoto
              ? currentSinglePhoto.dataUrl
              : capturedPhotos[croppingPhotoIndex]?.dataUrl || ''
          }
          imageName="camera-scan.jpg"
          onClose={() => setCroppingPhotoIndex(null)}
          onApplyCrop={handleApplyCroppedImage}
        />
      )}
    </div>
  );
};
