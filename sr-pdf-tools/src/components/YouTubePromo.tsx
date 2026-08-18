import React from 'react';
import { getSavedYouTubeConfig } from '../services/adService';
import { Youtube, ExternalLink, PlayCircle } from 'lucide-react';

interface YouTubePromoProps {
  onOpenAdmin?: () => void;
}

export const YouTubePromo: React.FC<YouTubePromoProps> = ({ onOpenAdmin }) => {
  const config = getSavedYouTubeConfig();

  if (!config.enabled) return null;

  // Extract YouTube video ID if URL provided
  let videoId: string | null = null;
  if (config.videoUrl) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = config.videoUrl.match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto my-8 px-4">
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <Youtube className="w-4 h-4 text-rose-600 fill-current" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
            Featured Video & Tutorials
          </span>
          <span className="text-[10px] text-slate-500 ml-auto bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            Promotion
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2 font-['Outfit']">
              {config.title}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              {config.description}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={config.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm transition-all hover:scale-[1.02]"
              >
                <Youtube className="w-4 h-4 fill-current" />
                {config.buttonText}
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </a>

              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-4 px-2 py-1"
                >
                  Edit Promo in Admin
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-5">
            {videoId ? (
              <div className="relative aspect-video rounded-xl overflow-hidden shadow-md border border-slate-200 bg-black">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <a
                href={config.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative aspect-video rounded-xl overflow-hidden bg-slate-50 border border-slate-200 hover:border-rose-300 transition-colors flex flex-col items-center justify-center p-4 text-center group cursor-pointer"
              >
                <PlayCircle className="w-12 h-12 text-rose-600 group-hover:scale-110 transition-transform mb-2" />
                <span className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">
                  Watch Video Tutorial
                </span>
                <span className="text-xs text-slate-500">Click to open on YouTube</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
