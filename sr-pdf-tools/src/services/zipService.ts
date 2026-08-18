import JSZip from 'jszip';

/**
 * Creates a ZIP archive Blob from an array of files/blobs without triggering download immediately
 */
export async function createZipArchive(
  files: { name: string; blob: Blob }[],
  onProgress?: (msg: string, percent: number) => void
): Promise<Blob> {
  onProgress?.('Initializing ZIP archive...', 10);
  const zip = new JSZip();

  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    const pct = Math.round(20 + (i / files.length) * 60);
    onProgress?.(`Archiving ${item.name}...`, pct);
    zip.file(item.name, item.blob);
  }

  onProgress?.('Compressing ZIP file...', 85);
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.('ZIP generated successfully!', 100);
  return zipBlob;
}

/**
 * Creates and triggers a ZIP download from an array of files/blobs
 */
export async function createAndDownloadZip(
  files: { name: string; blob: Blob }[],
  zipFilename: string = 'filemaster_archive.zip',
  onProgress?: (msg: string, percent: number) => void
): Promise<Blob> {
  onProgress?.('Initializing ZIP archive...', 10);
  const zip = new JSZip();

  for (let i = 0; i < files.length; i++) {
    const item = files[i];
    const pct = Math.round(20 + (i / files.length) * 60);
    onProgress?.(`Archiving ${item.name}...`, pct);
    zip.file(item.name, item.blob);
  }

  onProgress?.('Compressing ZIP file...', 85);
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.('ZIP generated successfully!', 100);
  return zipBlob;
}

/**
 * Triggers browser download for a Blob
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
