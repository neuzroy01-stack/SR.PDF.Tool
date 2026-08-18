export type ToolCategory = 'image' | 'pdf' | 'utilities' | 'admin';

export type ToolId = 
  | 'image-converter'
  | 'image-compressor'
  | 'image-editor'
  | 'image-to-pdf'
  | 'pdf-to-image'
  | 'pdf-compressor'
  | 'pdf-merger'
  | 'pdf-splitter'
  | 'pdf-page-manager'
  | 'doc-scanner'
  | 'document-scanner'
  | 'signature-maker'
  | 'passport-photo';

export type ToolType = ToolId | 'home';

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'bmp';
export type PdfPageSize = 'a4' | 'a5' | 'letter' | 'original';
export type PdfOrientation = 'portrait' | 'landscape' | 'auto';
export type PdfMargin = 'none' | 'small' | 'normal' | 'large';

export interface ImageFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  width?: number;
  height?: number;
  rotation?: number; // 0, 90, 180, 270
  enhanceScan?: boolean;
}

export interface PdfPageItem {
  pageNumber: number;
  originalPageNumber: number;
  rotation: number;
  previewUrl?: string;
  selected?: boolean;
}

export interface ConversionResult {
  blob: Blob;
  url: string;
  filename: string;
  originalSize: number;
  finalSize: number;
  format: string;
  compressionRatio: number; // e.g. 85.4 (%)
  width?: number;
  height?: number;
  pageCount?: number;
  previewUrl?: string;
  extraFiles?: { name: string; url: string; blob: Blob }[]; // for zip or multi-file
}

export interface ProcessingState {
  isProcessing: boolean;
  stepMessage: string;
  progressPercent: number;
  error: string | null;
}

export type AdPosition =
  | 'header'
  | 'homepage-top'
  | 'tool-top'
  | 'between-content'
  | 'result-top'
  | 'before-download'
  | 'sidebar'
  | 'footer'
  | 'mobile'
  | 'pdf-tools'
  | 'image-tools';

export interface AdSlotConfig {
  id: string;
  title: string;
  position: AdPosition;
  enabled: boolean;
  adCode: string; // custom AdSense / HTML snippet
  device: 'all' | 'desktop' | 'mobile';
  notes?: string;
}

export interface YouTubePromoConfig {
  enabled: boolean;
  videoUrl: string;
  channelUrl: string;
  title: string;
  description: string;
  buttonText: string;
}
