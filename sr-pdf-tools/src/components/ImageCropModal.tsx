import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  X,
  Crop as CropIcon,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Sliders,
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  imageName?: string;
  onClose: () => void;
  onApplyCrop: (croppedFile: File, croppedDataUrl: string) => void;
}

type AspectRatioOption = 'free' | '1:1' | '4:3' | '16:9' | '3:2' | 'a4';

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  imageName = 'image.jpg',
  onClose,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('free');
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  
  // Normalized crop box: x, y, width, height (all 0 to 1 relative to displayed image)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.05,
    y: 0.05,
    width: 0.9,
    height: 0.9,
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; initialBox: typeof cropBox }>({
    startX: 0,
    startY: 0,
    initialBox: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setCropBox({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
      setAspectRatio('free');
      setRotationAngle(0);
      setZoomLevel(1);

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, imageSrc]);

  // Adjust crop box when aspect ratio changes
  const applyAspectRatio = (ratio: AspectRatioOption) => {
    setAspectRatio(ratio);
    if (ratio === 'free') return;

    let targetRatio = 1;
    if (ratio === '1:1') targetRatio = 1;
    if (ratio === '4:3') targetRatio = 4 / 3;
    if (ratio === '16:9') targetRatio = 16 / 9;
    if (ratio === '3:2') targetRatio = 3 / 2;
    if (ratio === 'a4') targetRatio = 1 / 1.414; // A4 portrait

    if (imgRef.current) {
      const imgW = imgRef.current.clientWidth;
      const imgH = imgRef.current.clientHeight;
      if (imgW > 0 && imgH > 0) {
        const currentAspect = (imgW * 0.8) / (imgH * 0.8);
        let newW = 0.8;
        let newH = 0.8;

        if (targetRatio > currentAspect) {
          newH = (newW * imgW) / (targetRatio * imgH);
        } else {
          newW = (newH * imgH * targetRatio) / imgW;
        }

        newW = Math.min(0.95, Math.max(0.2, newW));
        newH = Math.min(0.95, Math.max(0.2, newH));

        setCropBox({
          x: Math.max(0.02, (1 - newW) / 2),
          y: Math.max(0.02, (1 - newH) / 2),
          width: newW,
          height: newH,
        });
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveHandle(handle);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !activeHandle || !imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;

    const deltaX = (e.clientX - dragStartRef.current.startX) / imgRect.width;
    const deltaY = (e.clientY - dragStartRef.current.startY) / imgRect.height;
    const init = dragStartRef.current.initialBox;

    let newX = init.x;
    let newY = init.y;
    let newW = init.width;
    let newH = init.height;

    const minSize = 0.08;

    if (activeHandle === 'center') {
      newX = Math.min(Math.max(0, init.x + deltaX), 1 - init.width);
      newY = Math.min(Math.max(0, init.y + deltaY), 1 - init.height);
    } else if (activeHandle === 'br') {
      newW = Math.min(Math.max(minSize, init.width + deltaX), 1 - init.x);
      newH = Math.min(Math.max(minSize, init.height + deltaY), 1 - init.y);
    } else if (activeHandle === 'tl') {
      const maxDeltaX = init.width - minSize;
      const maxDeltaY = init.height - minSize;
      const appliedDx = Math.min(Math.max(-init.x, deltaX), maxDeltaX);
      const appliedDy = Math.min(Math.max(-init.y, deltaY), maxDeltaY);
      newX = init.x + appliedDx;
      newY = init.y + appliedDy;
      newW = init.width - appliedDx;
      newH = init.height - appliedDy;
    } else if (activeHandle === 'tr') {
      const maxDeltaY = init.height - minSize;
      const appliedDy = Math.min(Math.max(-init.y, deltaY), maxDeltaY);
      newY = init.y + appliedDy;
      newH = init.height - appliedDy;
      newW = Math.min(Math.max(minSize, init.width + deltaX), 1 - init.x);
    } else if (activeHandle === 'bl') {
      const maxDeltaX = init.width - minSize;
      const appliedDx = Math.min(Math.max(-init.x, deltaX), maxDeltaX);
      newX = init.x + appliedDx;
      newW = init.width - appliedDx;
      newH = Math.min(Math.max(minSize, init.height + deltaY), 1 - init.y);
    }

    setCropBox({
      x: Math.max(0, Math.min(1 - minSize, newX)),
      y: Math.max(0, Math.min(1 - minSize, newY)),
      width: Math.max(minSize, Math.min(1 - newX, newW)),
      height: Math.max(minSize, Math.min(1 - newY, newH)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setActiveHandle(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleRotate = () => {
    setRotationAngle((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCropBox({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
    setAspectRatio('free');
    setRotationAngle(0);
    setZoomLevel(1);
  };

  // Perform actual Canvas Crop with rotation accounted for
  const handleConfirmCrop = async () => {
    if (!imgRef.current) return;

    try {
      const naturalImg = new Image();
      naturalImg.crossOrigin = 'anonymous';
      naturalImg.src = imageSrc;
      await new Promise((res, rej) => {
        naturalImg.onload = res;
        naturalImg.onerror = rej;
      });

      const origW = naturalImg.naturalWidth || naturalImg.width;
      const origH = naturalImg.naturalHeight || naturalImg.height;

      // Handle optional rotation prior to crop
      let sourceCanvas = document.createElement('canvas');
      if (rotationAngle % 180 !== 0) {
        sourceCanvas.width = origH;
        sourceCanvas.height = origW;
      } else {
        sourceCanvas.width = origW;
        sourceCanvas.height = origH;
      }

      const sCtx = sourceCanvas.getContext('2d');
      if (!sCtx) throw new Error('Canvas unavailable');

      sCtx.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
      sCtx.rotate((rotationAngle * Math.PI) / 180);
      sCtx.drawImage(naturalImg, -origW / 2, -origH / 2);

      const rw = sourceCanvas.width;
      const rh = sourceCanvas.height;

      const sx = Math.floor(cropBox.x * rw);
      const sy = Math.floor(cropBox.y * rh);
      const sw = Math.max(10, Math.floor(cropBox.width * rw));
      const sh = Math.max(10, Math.floor(cropBox.height * rh));

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = sw;
      finalCanvas.height = sh;
      const fCtx = finalCanvas.getContext('2d');
      if (!fCtx) throw new Error('Final canvas context unavailable');

      fCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise<Blob>((resolve) => {
        finalCanvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.95);
      });

      const cleanBase = imageName.replace(/\.[^/.]+$/, '');
      const croppedFile = new File([blob], `${cleanBase}_cropped.jpg`, {
        type: 'image/jpeg',
      });
      const croppedUrl = URL.createObjectURL(blob);

      onApplyCrop(croppedFile, croppedUrl);
      onClose();
    } catch (err) {
      console.error('Crop confirmation error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-[100dvh] w-full bg-slate-950/95 backdrop-blur-md select-none animate-in fade-in duration-200">
      
      {/* 1. Sticky Top Navigation Header */}
      <div className="shrink-0 px-4 py-3 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <CropIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base font-['Outfit'] leading-tight">
              Crop & Trim Image
            </h3>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Drag the bounding box or corners to select region
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Cancel and Exit"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Aspect Ratio Presets Bar */}
      <div className="shrink-0 px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none z-10">
        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mr-1 shrink-0">
          Ratio:
        </span>
        {[
          { key: 'free', label: 'Freeform' },
          { key: '1:1', label: '1:1 Square' },
          { key: '4:3', label: '4:3 Standard' },
          { key: '16:9', label: '16:9 Wide' },
          { key: '3:2', label: '3:2 Photo' },
          { key: 'a4', label: 'A4 Document' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => applyAspectRatio(item.key as AspectRatioOption)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer text-xs ${
              aspectRatio === item.key
                ? 'bg-indigo-600 text-white shadow-xs font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 3. Center Workspace: Responsive Viewport with Touch Drag */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden bg-black flex items-center justify-center p-3 sm:p-6 touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className="relative inline-block max-w-full max-h-full transition-transform duration-150"
          style={{
            transform: `scale(${zoomLevel})`,
          }}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop Target"
            draggable={false}
            style={{
              transform: `rotate(${rotationAngle}deg)`,
              maxHeight: 'calc(100dvh - 210px)',
              maxWidth: '92vw',
            }}
            className="object-contain pointer-events-none rounded shadow-2xl transition-transform duration-200"
          />

          {/* Darkened Mask Outside Crop Box */}
          <div
            className="absolute inset-0 bg-black/60 pointer-events-none"
            style={{
              clipPath: `polygon(
                0% 0%, 0% 100%, 
                ${cropBox.x * 100}% 100%, 
                ${cropBox.x * 100}% ${cropBox.y * 100}%, 
                ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%, 
                ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%, 
                ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%, 
                ${cropBox.x * 100}% 100%, 
                100% 100%, 100% 0%
              )`,
            }}
          />

          {/* Active Bounding Crop Box */}
          <div
            className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.8)] cursor-move"
            style={{
              left: `${cropBox.x * 100}%`,
              top: `${cropBox.y * 100}%`,
              width: `${cropBox.width * 100}%`,
              height: `${cropBox.height * 100}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'center')}
          >
            {/* Rule of Thirds Grid */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
              <div className="border-r border-b border-white/60"></div>
              <div className="border-r border-b border-white/60"></div>
              <div className="border-b border-white/60"></div>
              <div className="border-r border-b border-white/60"></div>
              <div className="border-r border-b border-white/60"></div>
              <div className="border-b border-white/60"></div>
              <div className="border-r border-white/60"></div>
              <div className="border-r border-white/60"></div>
              <div></div>
            </div>

            {/* Corner Handles (Large 28px touch targets) */}
            <div
              className="absolute -top-3.5 -left-3.5 w-7 h-7 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-lg flex items-center justify-center"
              onPointerDown={(e) => handlePointerDown(e, 'tl')}
            >
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            </div>
            <div
              className="absolute -top-3.5 -right-3.5 w-7 h-7 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-lg flex items-center justify-center"
              onPointerDown={(e) => handlePointerDown(e, 'tr')}
            >
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            </div>
            <div
              className="absolute -bottom-3.5 -left-3.5 w-7 h-7 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-lg flex items-center justify-center"
              onPointerDown={(e) => handlePointerDown(e, 'bl')}
            >
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            </div>
            <div
              className="absolute -bottom-3.5 -right-3.5 w-7 h-7 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-lg flex items-center justify-center"
              onPointerDown={(e) => handlePointerDown(e, 'br')}
            >
              <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Sticky Bottom Action Controls Toolbar (Always Visible) */}
      <div className="shrink-0 p-3 sm:p-4 bg-slate-900 border-t border-slate-800 text-white z-20 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Auxiliary Controls (Zoom, Rotate, Reset) */}
        <div className="flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(0.7, +(z - 0.15).toFixed(2)))}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <span className="text-[11px] font-mono font-bold text-slate-400 px-2">
            {Math.round(zoomLevel * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(2.0, +(z + 0.15).toFixed(2)))}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1"></div>

          <button
            type="button"
            onClick={handleRotate}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Rotate +90°"
          >
            <RotateCw className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Rotate</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Crop Box"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Primary Cancel & Apply Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-initial py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmCrop}
            className="flex-1 sm:flex-initial py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};
