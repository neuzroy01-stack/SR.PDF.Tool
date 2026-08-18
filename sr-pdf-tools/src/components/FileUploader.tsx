import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, AlertTriangle, X, Check } from 'lucide-react';
import { formatBytes, getImageDimensions } from '../services/imageService';
import { ImageFileItem } from '../types';

interface FileUploaderProps {
  accept: string; // e.g. "image/*", ".pdf", "image/jpeg,image/png,image/webp"
  multiple?: boolean;
  title?: string;
  subtitle?: string;
  maxSizeMB?: number;
  onFilesSelected: (files: File[], imageItems?: ImageFileItem[]) => void;
  selectedFiles?: File[];
  onClear?: () => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  accept,
  multiple = false,
  title = 'Drag & drop your file here',
  subtitle = 'or click to browse from your device',
  maxSizeMB = 100,
  onFilesSelected,
  selectedFiles = [],
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndProcessFiles = async (fileList: FileList | File[]) => {
    setErrorMsg(null);
    setLargeFileWarning(null);

    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    // Filter based on accept
    const acceptedExtensions = accept
      .split(',')
      .map((ext) => ext.trim().toLowerCase().replace('*', ''));

    const validFiles: File[] = [];
    const imageItems: ImageFileItem[] = [];

    for (const file of filesArray) {
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();

      // Check format
      const isAccepted = acceptedExtensions.some((ext) => {
        if (ext === 'image/') return fileType.startsWith('image/');
        if (ext === '.pdf' || ext === 'application/pdf') return fileName.endsWith('.pdf') || fileType === 'application/pdf';
        return fileName.endsWith(ext) || fileType.includes(ext.replace('.', ''));
      });

      if (!isAccepted && accept !== '*/*') {
        setErrorMsg(`"${file.name}" is an unsupported format. Accepted: ${accept}`);
        continue;
      }

      // Check size warning
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setErrorMsg(`"${file.name}" exceeds the maximum supported size of ${maxSizeMB} MB.`);
        continue;
      } else if (sizeMB > 40) {
        setLargeFileWarning(`Large file detected (${formatBytes(file.size)}). Processing may take a few extra moments in browser memory.`);
      }

      validFiles.push(file);

      // If image, create preview item and read dimensions
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        let width: number | undefined;
        let height: number | undefined;
        try {
          const dims = await getImageDimensions(file);
          width = dims.width;
          height = dims.height;
        } catch {
          // Ignore dimension failure
        }

        imageItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl,
          width,
          height,
          rotation: 0,
        });
      }
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles, imageItems);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFiles(e.target.files);
    }
  };

  const handleBrowseClick = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />

      {selectedFiles.length === 0 ? (
        <div
          id="file-drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
          className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01] shadow-lg shadow-indigo-500/10'
              : 'border-slate-300 hover:border-indigo-500 bg-white hover:bg-indigo-50/20 shadow-xs'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-110 group-hover:bg-indigo-100 transition-transform duration-300">
              <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors font-['Outfit']">
                {title}
              </h3>
              <p className="text-sm text-slate-500">
                {subtitle}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all"
              >
                Choose {multiple ? 'Files' : 'File'}
              </button>
            </div>

            <p className="text-xs text-slate-500 tracking-wide pt-2">
              Supports {accept.replace(/image\//g, '').replace(/application\//g, '')} • 100% Client-Side Privacy
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-slate-900">
                {selectedFiles.length} {selectedFiles.length === 1 ? 'File' : 'Files'} Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {multiple && (
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-600 font-medium transition-colors"
                >
                  + Add More
                </button>
              )}
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium transition-colors flex items-center gap-1 border border-rose-200"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shrink-0">
                    {file.type.includes('pdf') ? (
                      <FileText className="w-4 h-4 text-rose-500" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="font-semibold text-slate-800 truncate">{file.name}</p>
                    <p className="text-slate-500 text-[11px]">{formatBytes(file.size)}</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono uppercase bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 shrink-0">
                  {file.name.split('.').pop()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Large file warning */}
      {largeFileWarning && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{largeFileWarning}</span>
        </div>
      )}
    </div>
  );
};
