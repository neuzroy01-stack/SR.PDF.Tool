import React from 'react';
import { Heart, PenTool, User } from 'lucide-react';
import { ToolId } from '../types';
import { AdSlot } from './AdSlot';
import { Logo } from './Logo';

interface FooterProps {
  onSelectTool: (toolId: ToolId | 'home') => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTool }) => {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white text-slate-600">
      
      {/* Footer Ad Slot */}
      <div className="max-w-5xl mx-auto px-4 pt-8">
        <AdSlot position="footer" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand Info */}
          <div className="space-y-3">
            <div
              onClick={() => onSelectTool('home')}
              className="cursor-pointer hover:opacity-95 transition-opacity"
            >
              <Logo size="md" tagline="Free Online Suite by Satyam Ray" />
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              High-performance web platform for image conversion, compression, PDF editing, passport photos, and signature creation.
            </p>
          </div>

          {/* Specialty Tools Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Photo & Signature
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('passport-photo')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Passport Size Photo (Print Sheet)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('signature-maker')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PenTool className="w-3.5 h-3.5 text-purple-600" />
                  Signature Photo Maker (15–50 KB)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('image-converter')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  JPG / PNG / WEBP Converter
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('image-compressor')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Compress Image to Target KB
                </button>
              </li>
            </ul>
          </div>

          {/* PDF Tools Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              PDF Suite
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('pdf-compressor')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  PDF Compressor (Dual-Engine)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('image-to-pdf')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  Images to PDF (Batch & Crop)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('pdf-to-image')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  PDF to JPG / PNG (ZIP export)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('pdf-merger')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  PDF Merger (Combine PDFs)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onSelectTool('pdf-splitter')}
                  className="hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  PDF Splitter (Extract Pages)
                </button>
              </li>
            </ul>
          </div>

          {/* Creator Info */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Creator
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 shrink-0" />
                <span>Made by Satyam Ray</span>
              </li>
              <li className="text-slate-400">
                100% Free Forever
              </li>
              <li className="text-slate-400">
                High-Resolution 300 DPI Engine
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} SR Tools.</span>
            <span>•</span>
            <span className="text-indigo-600 font-semibold flex items-center gap-1">
              Crafted by Satyam Ray
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
