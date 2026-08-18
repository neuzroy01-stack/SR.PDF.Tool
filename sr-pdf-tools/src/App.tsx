import React, { useState, useEffect } from 'react';
import { ToolType } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { YouTubePromo } from './components/YouTubePromo';
import { UnifiedWorkspace } from './components/UnifiedWorkspace';
import { CreditsSection } from './components/CreditsSection';

// PDF & Specialist Tools
import { ImageToPdfTool } from './tools/ImageToPdfTool';
import { PdfToImageTool } from './tools/PdfToImageTool';
import { PdfCompressorTool } from './tools/PdfCompressorTool';
import { PdfMergerTool } from './tools/PdfMergerTool';
import { PdfSplitterTool } from './tools/PdfSplitterTool';
import { PdfPageManagerTool } from './tools/PdfPageManagerTool';
import { SignatureMakerTool } from './tools/SignatureMakerTool';
import { PassportPhotoTool } from './tools/PassportPhotoTool';

export function App() {
  const [activeTool, setActiveTool] = useState<ToolType>('home');

  // Dynamic SEO Title & Scroll on Tool Change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const titles: Record<string, string> = {
      home: 'SRPDF Tools — Free Online PDF Tools & Image Converter Suite',
      'image-to-pdf': 'Images to PDF Converter — SRPDF Tools',
      'pdf-to-image': 'PDF to JPG / PNG Converter — SRPDF Tools',
      'pdf-compressor': 'Compress PDF Online (Slider & Target Size) — SRPDF Tools',
      'pdf-merger': 'Merge PDF Files Online — SRPDF Tools',
      'pdf-splitter': 'Split PDF Pages Online — SRPDF Tools',
      'pdf-page-manager': 'Reorder & Rotate PDF Pages — SRPDF Tools',
      'signature-maker': 'Signature Photo Maker (15–50 KB) — SRPDF Tools',
      'passport-photo': 'Passport Size Photo & Print Sheet Maker — SRPDF Tools',
    };

    document.title = titles[activeTool] || 'SRPDF Tools — Free Online PDF Tools';
  }, [activeTool]);

  const isSpecialistTool = [
    'image-to-pdf',
    'pdf-to-image',
    'pdf-compressor',
    'pdf-merger',
    'pdf-splitter',
    'pdf-page-manager',
    'signature-maker',
    'passport-photo',
  ].includes(activeTool);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white font-['Plus_Jakarta_Sans']">
      
      {/* Navigation Header */}
      <Header
        activeTool={activeTool}
        onSelectTool={setActiveTool}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* If on Home or unified Image workflows, render Unified Workspace */}
        {!isSpecialistTool ? (
          <UnifiedWorkspace
            onSelectTool={(toolId) => setActiveTool(toolId)}
          />
        ) : (
          <div className="space-y-6">
            {/* Back button to Main Image Workspace */}
            <div className="flex items-center justify-between pb-2">
              <button
                type="button"
                onClick={() => setActiveTool('home')}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                ← Back to Workspace
              </button>
            </div>

            {/* Individual Specialist & PDF Tool Views */}
            {activeTool === 'image-to-pdf' && <ImageToPdfTool />}
            {activeTool === 'pdf-to-image' && <PdfToImageTool />}
            {activeTool === 'pdf-compressor' && <PdfCompressorTool />}
            {activeTool === 'pdf-merger' && <PdfMergerTool />}
            {activeTool === 'pdf-splitter' && <PdfSplitterTool />}
            {activeTool === 'pdf-page-manager' && <PdfPageManagerTool />}
            {activeTool === 'signature-maker' && <SignatureMakerTool />}
            {activeTool === 'passport-photo' && <PassportPhotoTool />}
          </div>
        )}

        {/* YouTube Channel Promotion Section */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <YouTubePromo />
        </div>

        {/* Satyam Ray Appreciation & Credits Section */}
        <CreditsSection />
      </main>

      {/* Footer */}
      <Footer onSelectTool={setActiveTool} />
    </div>
  );
}

export default App;
