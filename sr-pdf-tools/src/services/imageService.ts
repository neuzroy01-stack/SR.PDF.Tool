import { ImageFormat } from '../types';

/**
 * Loads an image from a File or Blob into an HTMLImageElement
 */
export function loadImage(fileOrBlob: Blob | File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const url = typeof fileOrBlob === 'string' ? fileOrBlob : URL.createObjectURL(fileOrBlob);
    
    img.onload = () => {
      if (typeof fileOrBlob !== 'string') {
        // Will be revoked later or keep
      }
      resolve(img);
    };
    
    img.onerror = (err) => {
      reject(new Error('Failed to load image. File may be corrupted or unsupported.'));
    };
    
    img.src = url;
  });
}

/**
 * Reads image dimensions without full canvas render
 */
export async function getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return { width, height };
}

/**
 * Creates a standard 24-bit uncompressed BMP Blob from Canvas ImageData
 */
export function canvasToBmpBlob(canvas: HTMLCanvasElement): Blob {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;

  // BMP header sizes
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const bytesPerPixel = 3;
  // Row size must be a multiple of 4 bytes
  const rowSize = Math.floor((bytesPerPixel * width + 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = fileHeaderSize + infoHeaderSize + pixelArraySize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // File Header
  view.setUint16(0, 0x4d42, false); // "BM"
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, fileHeaderSize + infoHeaderSize, true); // offset to pixels

  // Info Header (BITMAPINFOHEADER)
  view.setUint32(14, infoHeaderSize, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // Positive means bottom-up
  view.setUint16(26, 1, true); // Color planes
  view.setUint16(28, 24, true); // 24 bits per pixel
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // 72 DPI horizontal (pixels/meter)
  view.setInt32(42, 2835, true); // 72 DPI vertical
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  // Write pixel data (BMP is stored bottom-to-top, BGR order)
  let offset = fileHeaderSize + infoHeaderSize;
  const padding = rowSize - width * bytesPerPixel;

  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      view.setUint8(offset++, b);
      view.setUint8(offset++, g);
      view.setUint8(offset++, r);
    }
    for (let p = 0; p < padding; p++) {
      view.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Converts an image file to target format with specified quality
 */
export async function convertImageFormat(
  file: File | Blob,
  targetFormat: ImageFormat,
  quality: number = 0.92,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    rotation?: number; // 0, 90, 180, 270
    enhanceScan?: boolean;
    grayscale?: boolean;
  }
): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await loadImage(file);
  let srcWidth = img.naturalWidth || img.width;
  let srcHeight = img.naturalHeight || img.height;

  const rotation = options?.rotation || 0;
  const isRotated90or270 = rotation === 90 || rotation === 270;

  let targetWidth = options?.maxWidth || srcWidth;
  let targetHeight = options?.maxHeight || srcHeight;

  // Maintain aspect ratio if dimensions specified
  if (options?.maxWidth && !options?.maxHeight) {
    targetHeight = Math.round((srcHeight / srcWidth) * options.maxWidth);
  } else if (!options?.maxWidth && options?.maxHeight) {
    targetWidth = Math.round((srcWidth / srcHeight) * options.maxHeight);
  }

  const canvas = document.createElement('canvas');
  canvas.width = isRotated90or270 ? targetHeight : targetWidth;
  canvas.height = isRotated90or270 ? targetWidth : targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  // Quality rendering settings
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background for formats that don't support alpha (JPEG)
  if (targetFormat === 'jpeg' || options?.enhanceScan) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.save();
  // Handle rotation
  if (rotation !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  } else {
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  }
  ctx.restore();

  // Apply Document Scan Enhancement if requested
  if (options?.enhanceScan) {
    enhanceScanData(ctx, canvas.width, canvas.height, options.grayscale ?? false);
  } else if (options?.grayscale) {
    applyGrayscale(ctx, canvas.width, canvas.height);
  }

  if (targetFormat === 'bmp') {
    const bmpBlob = canvasToBmpBlob(canvas);
    return { blob: bmpBlob, width: canvas.width, height: canvas.height };
  }

  const mimeType = targetFormat === 'jpeg' ? 'image/jpeg' : targetFormat === 'webp' ? 'image/webp' : 'image/png';

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate image blob'));
      },
      mimeType,
      targetFormat === 'png' ? undefined : quality
    );
  });

  return { blob, width: canvas.width, height: canvas.height };
}

export function enhanceDocumentScan(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: {
    contrastBoost?: number;
    brightnessOffset?: number;
    grayscale?: boolean;
    sharpen?: boolean;
  }
) {
  const contrastBoost = options?.contrastBoost ?? 1.3;
  const brightnessOffset = options?.brightnessOffset ?? 15;
  const isGrayscale = options?.grayscale ?? false;
  const isSharpen = options?.sharpen ?? true;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Histogram analysis
  let minLum = 255;
  let maxLum = 0;
  for (let i = 0; i < data.length; i += 16) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }
  const range = Math.max(1, maxLum - minLum);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    let normalized = ((lum - minLum) / range) * 255;
    normalized = Math.min(255, Math.max(0, (normalized - 128) * contrastBoost + 128 + brightnessOffset));

    let enhancedLum: number;
    if (normalized > 185) {
      enhancedLum = 255;
    } else if (normalized < 90) {
      enhancedLum = normalized * 0.7;
    } else {
      const t = (normalized - 90) / 95;
      enhancedLum = 63 + t * (255 - 63);
    }

    if (isGrayscale) {
      data[i] = enhancedLum;
      data[i + 1] = enhancedLum;
      data[i + 2] = enhancedLum;
    } else {
      const factor = enhancedLum / Math.max(1, lum);
      data[i] = Math.min(255, Math.max(0, r * factor));
      data[i + 1] = Math.min(255, Math.max(0, g * factor));
      data[i + 2] = Math.min(255, Math.max(0, b * factor));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  if (isSharpen) {
    applySharpenFilter(ctx, width, height, 0.3);
  }
}

/**
 * Intelligent Document Scan Enhancement:
 * - White background brightening (thresholding shadows)
 * - Contrast & clarity boost
 * - Optional grayscale
 * - Text sharpening filter
 */
export function enhanceScanData(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grayscale: boolean = false
) {
  enhanceDocumentScan(ctx, width, height, { grayscale, contrastBoost: 1.3, brightnessOffset: 15, sharpen: true });
}

function applyGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);
}

function applySharpenFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number = 0.3
) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const src = new Uint8ClampedArray(imgData.data);
    const dst = imgData.data;

    // Convolution weights
    const center = 1 + 4 * strength;
    const neighbor = -strength;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        for (let c = 0; c < 3; c++) {
          const top = src[((y - 1) * width + x) * 4 + c];
          const bottom = src[((y + 1) * width + x) * 4 + c];
          const left = src[(y * width + (x - 1)) * 4 + c];
          const right = src[(y * width + (x + 1)) * 4 + c];
          const curr = src[idx + c];

          const val = curr * center + (top + bottom + left + right) * neighbor;
          dst[idx + c] = Math.min(255, Math.max(0, val));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Gracefully ignore if edge case
  }
}

/**
 * High-precision Binary Search Image Compressor
 * Intelligently balances JPEG/WebP quality (0.05 to 0.98) and image dimension downscaling
 * to reach target byte size (e.g. 50 KB, 200 KB, 1.5 MB) with maximum visual sharpness.
 */
export async function compressImageToTargetSize(
  file: File | Blob,
  targetSizeBytes: number,
  onProgress?: (msg: string, percent: number) => void
): Promise<{ blob: Blob; quality: number; scale: number; width: number; height: number; finalSize: number }> {
  onProgress?.('Loading image for analysis...', 10);
  const img = await loadImage(file);
  const origWidth = img.naturalWidth || img.width;
  const origHeight = img.naturalHeight || img.height;

  // If already smaller than target, export directly with high quality
  if (file.size <= targetSizeBytes) {
    onProgress?.('Image already within target size, optimizing format...', 50);
    const res = await convertImageFormat(file, 'jpeg', 0.92);
    if (res.blob.size <= targetSizeBytes) {
      return {
        blob: res.blob,
        quality: 0.92,
        scale: 1.0,
        width: res.width,
        height: res.height,
        finalSize: res.blob.size,
      };
    }
  }

  // Binary search for optimal quality & dimension scale
  let bestBlob: Blob | null = null;
  let bestQuality = 0.85;
  let bestScale = 1.0;
  let bestDiff = Infinity;

  // We test scale factors: 1.0 -> 0.85 -> 0.7 -> 0.5 -> 0.35 -> 0.25
  const scalesToTry = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25];

  for (let sIdx = 0; sIdx < scalesToTry.length; sIdx++) {
    const scale = scalesToTry[sIdx];
    const curW = Math.max(100, Math.round(origWidth * scale));
    const curH = Math.max(100, Math.round(origHeight * scale));

    onProgress?.(`Optimizing compression (Scale ${Math.round(scale * 100)}%)...`, 20 + sIdx * 12);

    const canvas = document.createElement('canvas');
    canvas.width = curW;
    canvas.height = curH;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, curW, curH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, curW, curH);

    // Binary search quality between 0.05 and 0.95
    let lowQ = 0.05;
    let highQ = 0.95;
    let iterations = 7; // 7 iterations gives precision within 0.007

    while (iterations > 0) {
      const midQ = (lowQ + highQ) / 2;
      const testBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', midQ);
      });

      const curSize = testBlob.size;
      const diff = Math.abs(curSize - targetSizeBytes);

      // Prefer sizes that are <= targetSizeBytes, or minimal absolute diff
      if (curSize <= targetSizeBytes) {
        if (!bestBlob || curSize > bestBlob.size || diff < bestDiff) {
          bestBlob = testBlob;
          bestDiff = diff;
          bestQuality = midQ;
          bestScale = scale;
        }
        // Try higher quality to get closer to target from below
        lowQ = midQ;
      } else {
        // Size is larger than target, decrease quality
        highQ = midQ;
        // If we haven't found any blob <= target yet, keep this as backup
        if (!bestBlob || diff < bestDiff) {
          bestBlob = testBlob;
          bestDiff = diff;
          bestQuality = midQ;
          bestScale = scale;
        }
      }

      // If we are within 2% of target size, that's ideal!
      if (curSize <= targetSizeBytes && (targetSizeBytes - curSize) / targetSizeBytes < 0.03) {
        break;
      }

      iterations--;
    }

    // If we reached a satisfactory compression under or very close to target, stop searching lower scales
    if (bestBlob && bestBlob.size <= targetSizeBytes && bestBlob.size >= targetSizeBytes * 0.75) {
      break;
    }
  }

  onProgress?.('Finalizing optimized result...', 95);

  if (!bestBlob) {
    const fallback = await convertImageFormat(file, 'jpeg', 0.6);
    return {
      blob: fallback.blob,
      quality: 0.6,
      scale: 1.0,
      width: fallback.width,
      height: fallback.height,
      finalSize: fallback.blob.size,
    };
  }

  const finalImgDims = await getImageDimensions(bestBlob);

  return {
    blob: bestBlob,
    quality: Math.round(bestQuality * 100) / 100,
    scale: bestScale,
    width: finalImgDims.width,
    height: finalImgDims.height,
    finalSize: bestBlob.size,
  };
}

/**
 * Format bytes to readable string (e.g. 2.45 MB, 180 KB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Parse human size input (e.g. "75 KB", "1.5 MB", "500kb") to bytes
 */
export function parseSizeInputToBytes(input: string): number | null {
  const clean = input.trim().toLowerCase();
  const match = clean.match(/^([\d.]+)\s*(bytes|b|kb|k|mb|m|gb|g)?$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (isNaN(value) || value <= 0) return null;

  const unit = match[2] || 'kb'; // default to KB

  if (unit === 'bytes' || unit === 'b') return Math.round(value);
  if (unit === 'kb' || unit === 'k') return Math.round(value * 1024);
  if (unit === 'mb' || unit === 'm') return Math.round(value * 1024 * 1024);
  if (unit === 'gb' || unit === 'g') return Math.round(value * 1024 * 1024 * 1024);

  return Math.round(value * 1024);
}
