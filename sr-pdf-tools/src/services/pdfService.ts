import { PDFDocument, degrees, PageSizes } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { ImageFileItem, PdfPageSize, PdfOrientation, PdfMargin, PdfPageItem } from '../types';
import { convertImageFormat } from './imageService';

// Initialize PDF.js worker reliably
if (typeof window !== 'undefined') {
  try {
    const version = pdfjsLib.version || '6.2.108';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker initialization note:', e);
  }
}

/**
 * Helper to build safe PDF loading task options with fallback CMaps and password support.
 * CRITICAL: Always clones the buffer into a fresh Uint8Array so worker transfer
 * NEVER detaches the caller's master ArrayBuffer.
 */
function createPdfLoadingTask(data: ArrayBuffer | Uint8Array, password?: string) {
  const version = pdfjsLib.version || '6.2.108';
  let uint8Data: Uint8Array;
  if (data instanceof Uint8Array) {
    uint8Data = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  } else {
    uint8Data = new Uint8Array(data.slice(0));
  }

  return pdfjsLib.getDocument({
    data: uint8Data,
    password: password || undefined,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/standard_fonts/`,
  });
}

/**
 * Check if an error was caused by a password-protected PDF
 */
export function isPasswordError(err: any): boolean {
  if (!err) return false;
  const name = err.name || '';
  const msg = (err.message || '').toLowerCase();
  const code = err.code || 0;
  return (
    name === 'PasswordException' ||
    name === 'MissingPasswordException' ||
    code === 1 || // PasswordResponses.NEED_PASSWORD
    code === 2 || // PasswordResponses.INCORRECT_PASSWORD
    msg.includes('password') ||
    msg.includes('encrypted') ||
    msg.includes('passwordprotected')
  );
}

/**
 * Check if an error was caused by wrong password
 */
export function isIncorrectPasswordError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || 0;
  return code === 2 || msg.includes('incorrect password') || msg.includes('wrong password') || msg.includes('invalid password');
}

/**
 * Convert an array of images to a single PDF document
 */
export async function imagesToPdf(
  images: ImageFileItem[],
  options: {
    pageSize: PdfPageSize;
    orientation: PdfOrientation;
    margin: PdfMargin;
    documentScanAll?: boolean;
    grayscaleAll?: boolean;
    customMarginPt?: number;
    qualityLevel?: number; // 0 (min size) to 100 (max quality), default 80
  },
  onProgress?: (msg: string, percent: number) => void
): Promise<Blob> {
  if (!images.length) throw new Error('No images provided for PDF creation');

  onProgress?.('Initializing PDF document...', 10);
  const pdfDoc = await PDFDocument.create();

  // Margin calculation in points (72 points = 1 inch)
  let marginPt = 0;
  if (options.margin === 'small') marginPt = 18; // 0.25 inch
  if (options.margin === 'normal') marginPt = 36; // 0.5 inch
  if (options.margin === 'large') marginPt = 54; // 0.75 inch
  if (options.customMarginPt !== undefined) marginPt = options.customMarginPt;

  const qualityRatio = (options.qualityLevel !== undefined ? options.qualityLevel : 80) / 100;
  const jpegQuality = 0.45 + qualityRatio * 0.50;

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const stepPct = Math.round(15 + (i / images.length) * 75);
    onProgress?.(`Processing image ${i + 1} of ${images.length}...`, stepPct);

    // Apply rotation or scan enhancement
    const rotation = item.rotation || 0;
    const shouldEnhance = item.enhanceScan || options.documentScanAll;
    const shouldGrayscale = options.grayscaleAll;

    // Convert/process image to clean JPEG
    const processed = await convertImageFormat(
      item.file,
      'jpeg',
      jpegQuality,
      {
        rotation,
        enhanceScan: shouldEnhance,
        grayscale: shouldGrayscale,
      }
    );

    const imageBytes = await processed.blob.arrayBuffer();
    const embeddedImage = await pdfDoc.embedJpg(imageBytes);

    const imgW = embeddedImage.width;
    const imgH = embeddedImage.height;

    // Calculate Page Dimensions
    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === 'fit') {
      pageWidth = imgW + marginPt * 2;
      pageHeight = imgH + marginPt * 2;
    } else {
      let dims: [number, number];
      if (options.pageSize === 'a3') dims = [PageSizes.A3[0], PageSizes.A3[1]];
      else if (options.pageSize === 'a5') dims = [PageSizes.A5[0], PageSizes.A5[1]];
      else if (options.pageSize === 'letter') dims = [PageSizes.Letter[0], PageSizes.Letter[1]];
      else if (options.pageSize === 'legal') dims = [PageSizes.Legal[0], PageSizes.Legal[1]];
      else dims = [PageSizes.A4[0], PageSizes.A4[1]];

      if (options.orientation === 'landscape') {
        pageWidth = Math.max(dims[0], dims[1]);
        pageHeight = Math.min(dims[0], dims[1]);
      } else if (options.orientation === 'portrait') {
        pageWidth = Math.min(dims[0], dims[1]);
        pageHeight = Math.max(dims[0], dims[1]);
      } else {
        if (imgW > imgH) {
          pageWidth = Math.max(dims[0], dims[1]);
          pageHeight = Math.min(dims[0], dims[1]);
        } else {
          pageWidth = Math.min(dims[0], dims[1]);
          pageHeight = Math.max(dims[0], dims[1]);
        }
      }
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Fit image inside usable bounds
    const usableW = Math.max(1, pageWidth - marginPt * 2);
    const usableH = Math.max(1, pageHeight - marginPt * 2);

    const scale = Math.min(usableW / imgW, usableH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const x = marginPt + (usableW - drawW) / 2;
    const y = marginPt + (usableH - drawH) / 2;

    page.drawImage(embeddedImage, {
      x,
      y,
      width: drawW,
      height: drawH,
    });
  }

  onProgress?.('Saving PDF document...', 95);
  const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * Get basic info about a PDF file (page count, encryption status)
 */
export async function getPdfDetails(
  file: File | Blob,
  password?: string
): Promise<{ pageCount: number; isPasswordProtected: boolean }> {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = createPdfLoadingTask(arrayBuffer, password);
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    await pdf.destroy();
    return { pageCount, isPasswordProtected: false };
  } catch (err: any) {
    if (isPasswordError(err)) {
      const error = new Error('This PDF is password protected. Please enter the password to continue.');
      (error as any).isPasswordProtected = true;
      (error as any).isIncorrectPassword = Boolean(password);
      throw error;
    }

    // Try PDF-Lib fallback to verify if file is valid
    try {
      const doc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
      return { pageCount: doc.getPageCount(), isPasswordProtected: false };
    } catch (fallbackErr: any) {
      if (isPasswordError(fallbackErr)) {
        const error = new Error('This PDF is password protected. Please enter the password to continue.');
        (error as any).isPasswordProtected = true;
        throw error;
      }
    }

    console.error('getPdfDetails error:', err);
    throw new Error('This PDF file could not be opened. The file may be damaged or in an unsupported format.');
  }
}

/**
 * Render a single page of a PDF file to an HTMLCanvasElement with password support
 */
export async function renderPdfPageToCanvas(
  fileOrBuffer: File | Blob | ArrayBuffer,
  pageNumber: number,
  scale: number = 1.5,
  password?: string
): Promise<HTMLCanvasElement> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer.slice(0);
  } else {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  }

  const loadingTask = createPdfLoadingTask(arrayBuffer, password);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context not available');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext: any = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await page.render(renderContext).promise;
  page.cleanup();
  await pdf.destroy();

  return canvas;
}

/**
 * Convert PDF pages to JPG or PNG images with progress & page selection.
 * Fully protects against Detached ArrayBuffer by reusing a single PDF instance
 * and safely cloning memory buffers.
 */
export async function pdfToImages(
  file: File | Blob,
  options: {
    format: 'jpeg' | 'png';
    dpi: number; // 72, 150, 300
    quality?: number;
    selectedPages?: number[];
    password?: string;
  },
  onProgress?: (msg: string, percent: number) => void
): Promise<{ pageNumber: number; blob: Blob; filename: string; previewUrl: string; width: number; height: number }[]> {
  let pdf: any = null;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = createPdfLoadingTask(arrayBuffer, options.password);
    pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    const pagesToConvert = options.selectedPages && options.selectedPages.length > 0
      ? options.selectedPages.filter((p) => p >= 1 && p <= totalPages)
      : Array.from({ length: totalPages }, (_, i) => i + 1);

    const results: { pageNumber: number; blob: Blob; filename: string; previewUrl: string; width: number; height: number }[] = [];
    const baseName = (file as File).name ? (file as File).name.replace(/\.[^/.]+$/, '') : 'document';
    const scale = Math.max(0.8, options.dpi / 72);

    for (let i = 0; i < pagesToConvert.length; i++) {
      const pageNum = pagesToConvert[i];
      const pct = Math.round(10 + (i / pagesToConvert.length) * 80);
      onProgress?.(`Rendering page ${pageNum} (${i + 1}/${pagesToConvert.length})...`, pct);

      // Directly get page from already-loaded PDF instance (no re-reading detached buffers)
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const mimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const quality = options.quality ?? (options.format === 'jpeg' ? 0.92 : undefined);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`Failed to convert page ${pageNum} to image`));
          },
          mimeType,
          quality
        );
      });

      // Strictly .jpg for JPEG, .png for PNG
      const ext = options.format === 'jpeg' ? 'jpg' : 'png';
      const filename = `${baseName}_page_${pageNum}.${ext}`;
      const previewUrl = URL.createObjectURL(blob);

      results.push({
        pageNumber: pageNum,
        blob,
        filename,
        previewUrl,
        width: canvas.width,
        height: canvas.height,
      });

      // Free canvas memory & clean page resources
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }

    onProgress?.('Image extraction complete!', 100);
    return results;
  } catch (err: any) {
    console.error('pdfToImages error:', err);
    if (isPasswordError(err)) {
      const error = new Error(
        options.password
          ? 'Incorrect password for this PDF. Please verify and try again.'
          : 'This PDF is password protected. Please enter the password to continue.'
      );
      (error as any).isPasswordProtected = true;
      (error as any).isIncorrectPassword = Boolean(options.password);
      throw error;
    }
    throw new Error(err.message || 'This PDF could not be processed. The file may be damaged or unsupported.');
  } finally {
    if (pdf) {
      try {
        await pdf.destroy();
      } catch (e) {
        // ignore destruction notice
      }
    }
  }
}

/**
 * Merge multiple PDF files into one
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (msg: string, percent: number) => void
): Promise<Blob> {
  if (files.length < 2) {
    throw new Error('Please select at least 2 PDF files to merge.');
  }

  onProgress?.('Creating empty document...', 10);
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = Math.round(15 + (i / files.length) * 75);
    onProgress?.(`Merging ${file.name} (${i + 1}/${files.length})...`, pct);

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  onProgress?.('Finalizing merged PDF...', 95);
  const pdfBytes = await mergedPdf.save({ useObjectStreams: true });
  return new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * Split a PDF into separate files or extract specific ranges
 */
export async function splitPdfDocument(
  file: File,
  splitConfig: {
    mode: 'all' | 'ranges' | 'single';
    ranges?: string; // e.g. "1-3, 5, 8-10"
    singlePage?: number;
  },
  onProgress?: (msg: string, percent: number) => void
): Promise<{ filename: string; blob: Blob }[]> {
  onProgress?.('Reading PDF pages for splitting...', 10);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const results: { filename: string; blob: Blob }[] = [];

  if (splitConfig.mode === 'single' && splitConfig.singlePage) {
    const pageIdx = splitConfig.singlePage - 1;
    if (pageIdx < 0 || pageIdx >= totalPages) throw new Error('Selected page is out of range');

    const newDoc = await PDFDocument.create();
    const [copied] = await newDoc.copyPages(srcDoc, [pageIdx]);
    newDoc.addPage(copied);

    const bytes = await newDoc.save({ useObjectStreams: true });
    results.push({
      filename: `${baseName}_page_${splitConfig.singlePage}.pdf`,
      blob: new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    });
    return results;
  }

  if (splitConfig.mode === 'all') {
    for (let i = 0; i < totalPages; i++) {
      const pct = Math.round(15 + (i / totalPages) * 75);
      onProgress?.(`Extracting page ${i + 1} of ${totalPages}...`, pct);

      const newDoc = await PDFDocument.create();
      const [copied] = await newDoc.copyPages(srcDoc, [i]);
      newDoc.addPage(copied);

      const bytes = await newDoc.save({ useObjectStreams: true });
      results.push({
        filename: `${baseName}_page_${i + 1}.pdf`,
        blob: new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      });
    }
    return results;
  }

  if (splitConfig.mode === 'ranges' && splitConfig.ranges) {
    const pageIndices = parsePageRangeString(splitConfig.ranges, totalPages);
    if (pageIndices.length === 0) throw new Error('No valid pages found in specified range');

    onProgress?.('Creating custom range PDF...', 50);
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    const bytes = await newDoc.save({ useObjectStreams: true });
    results.push({
      filename: `${baseName}_custom_range.pdf`,
      blob: new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    });
    return results;
  }

  return results;
}

/**
 * Reorder, rotate, or delete specific pages of a PDF document
 */
export async function managePdfPages(
  file: File,
  pagesConfig: PdfPageItem[],
  onProgress?: (msg: string, percent: number) => void
): Promise<Blob> {
  if (!pagesConfig.length) throw new Error('No pages selected in the document.');

  onProgress?.('Reconstructing PDF pages...', 20);
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  for (let i = 0; i < pagesConfig.length; i++) {
    const item = pagesConfig[i];
    const pct = Math.round(25 + (i / pagesConfig.length) * 65);
    onProgress?.(`Processing page ${i + 1} (Source: ${item.originalPageNumber})...`, pct);

    const [copiedPage] = await newDoc.copyPages(srcDoc, [item.originalPageNumber - 1]);
    
    if (item.rotation) {
      const currentRotation = copiedPage.getRotation().angle;
      copiedPage.setRotation(degrees((currentRotation + item.rotation) % 360));
    }

    newDoc.addPage(copiedPage);
  }

  onProgress?.('Saving updated PDF...', 95);
  const bytes = await newDoc.save({ useObjectStreams: true });
  return new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

/**
 * Dual-Engine PDF Compressor
 * - Engine 1: High-Efficiency Visual & Scan Optimizer (PDF.js + Canvas + PDF-Lib)
 * - Engine 2 (Fail-Safe Fallback): Structural Stream & Object Optimization
 * - Handles Password Protected PDFs, Scanned PDFs, Large Documents, and Mixed Formats
 */
export async function compressPdfDocument(
  file: File | Blob,
  sliderValue: number, // 0 = Light / Max Quality, 100 = Maximum Compression / Min Size
  options?: {
    password?: string;
  },
  onProgress?: (msg: string, percent: number) => void
): Promise<{ blob: Blob; originalSize: number; finalSize: number; compressionRatio: number; engineUsed: 'visual' | 'structural' }> {
  const origSize = file.size;
  const password = options?.password;

  onProgress?.('Analyzing PDF document structure...', 10);
  const arrayBuffer = await file.arrayBuffer();

  let pdf: any = null;
  try {
    // Attempt Engine 1: Visual & Scan Re-encoding
    const compressionFactor = Math.min(100, Math.max(0, sliderValue)) / 100;
    
    // Smooth adaptive DPI: 160 DPI (light) down to 85 DPI (max)
    const dpi = Math.round(160 - compressionFactor * 75);
    // Smooth adaptive JPEG Quality: 0.88 down to 0.45
    const quality = +(0.88 - compressionFactor * 0.43).toFixed(2);

    const loadingTask = createPdfLoadingTask(arrayBuffer, password);
    pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    const optimizedDoc = await PDFDocument.create();
    const scale = dpi / 72;

    for (let i = 1; i <= totalPages; i++) {
      const pct = Math.round(15 + (i / totalPages) * 75);
      onProgress?.(`Compressing page ${i} of ${totalPages}...`, pct);

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context not available');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;

      const jpegBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
      });

      // Free canvas & page
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;

      const imgBytes = await jpegBlob.arrayBuffer();
      const embeddedImg = await optimizedDoc.embedJpg(imgBytes);

      // Get natural unscaled page dimensions
      const naturalViewport = page.getViewport({ scale: 1.0 });
      const newPage = optimizedDoc.addPage([naturalViewport.width, naturalViewport.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: naturalViewport.width,
        height: naturalViewport.height,
      });
    }

    onProgress?.('Finalizing compressed PDF...', 95);
    const pdfBytes = await optimizedDoc.save({ useObjectStreams: true });
    const finalBlob = new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
    const finalSize = finalBlob.size;
    const ratio = Math.max(0, Math.round(((origSize - finalSize) / origSize) * 1000) / 10);

    return {
      blob: finalBlob,
      originalSize: origSize,
      finalSize: finalSize,
      compressionRatio: ratio,
      engineUsed: 'visual',
    };
  } catch (err: any) {
    console.warn('Engine 1 compression note:', err);

    // If it's a password error, don't fallback; ask user for password!
    if (isPasswordError(err)) {
      const error = new Error(
        password
          ? 'Incorrect password provided for this PDF. Please enter the correct password.'
          : 'This PDF is password protected. Please enter the password to continue.'
      );
      (error as any).isPasswordProtected = true;
      (error as any).isIncorrectPassword = Boolean(password);
      throw error;
    }

    // Engine 2: Fail-Safe Structural Optimization via PDF-Lib
    onProgress?.('Applying structural stream compression fallback...', 50);
    try {
      const srcDoc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((page) => newDoc.addPage(page));

      onProgress?.('Saving optimized structure...', 90);
      const pdfBytes = await newDoc.save({ useObjectStreams: true });
      const finalBlob = new Blob([pdfBytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
      const finalSize = finalBlob.size;
      const ratio = Math.max(0, Math.round(((origSize - finalSize) / origSize) * 1000) / 10);

      return {
        blob: finalBlob,
        originalSize: origSize,
        finalSize: finalSize,
        compressionRatio: ratio,
        engineUsed: 'structural',
      };
    } catch (fallbackErr: any) {
      console.error('Engine 2 fallback error:', fallbackErr);
      if (isPasswordError(fallbackErr)) {
        const error = new Error('This PDF is password protected. Please enter the password to continue.');
        (error as any).isPasswordProtected = true;
        throw error;
      }
      throw new Error(
        'This PDF could not be compressed. The file may be damaged or in an unsupported format.'
      );
    }
  } finally {
    if (pdf) {
      try {
        await pdf.destroy();
      } catch (e) {
        // ignore
      }
    }
  }
}

/**
 * Helper to parse page range strings like "1-3, 5, 8-10" into 0-indexed array
 */
function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
  const indices = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/);

  for (const part of parts) {
    if (!part.trim()) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) indices.add(i - 1);
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        indices.add(pageNum - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}
