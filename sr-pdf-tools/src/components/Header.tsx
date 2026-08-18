import React, { useState } from 'react';
import {
  Image as ImageIcon,
  FileText,
  ChevronDown,
  Menu,
  X,
  PenTool,
  User,
} from 'lucide-react';
import { ToolId } from '../types';
import { Logo } from './Logo';

interface HeaderProps {
  activeTool: ToolId | 'home';
  onSelectTool: (toolId: ToolId | 'home') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTool, onSelectTool }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);

  const handleNav = (tool: ToolId | 'home') => {
    onSelectTool(tool);
    setMobileMenuOpen(false);
    setPdfDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 border-b border-slate-200 backdrop-blur-md shadow-xs">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            onClick={() => handleNav('home')}
            className="cursor-pointer hover:opacity-95 transition-opacity"
          >
            <Logo size="md" tagline="By Satyam Ray • 100% Free" />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'home'
                  ? 'bg-slate-100 text-indigo-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              Image Suite
            </button>

            {/* PDF Tools Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTool.startsWith('pdf') || activeTool === 'image-to-pdf'
                    ? 'bg-slate-100 text-indigo-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                PDF Suite
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {pdfDropdownOpen && (
                <div
                  onMouseLeave={() => setPdfDropdownOpen(false)}
                  className="absolute left-0 mt-2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <button
                    type="button"
                    onClick={() => handleNav('pdf-compressor')}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>Compress PDF (Slider)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('image-to-pdf')}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>Images to PDF (Batch & Crop)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('pdf-to-image')}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>PDF to JPG / PNG (ZIP)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('pdf-merger')}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>Merge PDFs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('pdf-splitter')}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>Split PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('pdf-page-manager')}
                    className="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 flex items-center justify-between cursor-pointer"
                  >
                    <span>Reorder & Rotate Pages</span>
                  </button>
                </div>
              )}
            </div>

            {/* Passport Photo Link */}
            <button
              type="button"
              onClick={() => handleNav('passport-photo')}
              className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'passport-photo'
                  ? 'bg-slate-100 text-indigo-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4 text-emerald-600" />
              Passport Photo
            </button>

            {/* Signature Maker Link */}
            <button
              type="button"
              onClick={() => handleNav('signature-maker')}
              className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'signature-maker'
                  ? 'bg-slate-100 text-indigo-600 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <PenTool className="w-4 h-4 text-purple-600" />
              Signature Maker
            </button>
          </nav>

          {/* Right Action: Mobile Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 md:hidden cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-slate-100 space-y-1 text-sm animate-in slide-in-from-top-2 duration-150">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
            >
              <ImageIcon className="w-4 h-4 text-indigo-600" />
              Image Tools Workspace
            </button>

            <button
              type="button"
              onClick={() => handleNav('passport-photo')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 font-medium flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                Passport Size Photo (Print Sheet)
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('signature-maker')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 font-medium flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-purple-600" />
                Signature Maker (15–50 KB)
              </span>
            </button>

            <div className="pt-2 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              PDF Suite
            </div>

            <button
              type="button"
              onClick={() => handleNav('pdf-compressor')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center justify-between"
            >
              <span>Compress PDF (Slider)</span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('image-to-pdf')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50"
            >
              Images to PDF (Batch & Crop)
            </button>

            <button
              type="button"
              onClick={() => handleNav('pdf-to-image')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50"
            >
              PDF to JPG / PNG (ZIP Export)
            </button>

            <button
              type="button"
              onClick={() => handleNav('pdf-merger')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50"
            >
              Merge PDFs
            </button>

            <button
              type="button"
              onClick={() => handleNav('pdf-splitter')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50"
            >
              Split PDF
            </button>

            <button
              type="button"
              onClick={() => handleNav('pdf-page-manager')}
              className="w-full text-left px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50"
            >
              Reorder & Rotate Pages
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
