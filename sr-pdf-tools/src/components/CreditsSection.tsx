import React from 'react';
import { Heart, Sparkles, ShieldCheck, Zap, Globe, Star } from 'lucide-react';
import { Logo } from './Logo';

export const CreditsSection: React.FC = () => {
  return (
    <section className="w-full max-w-5xl mx-auto my-12 px-4 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white p-6 sm:p-10 border border-slate-800 shadow-xl">
        {/* Subtle Background Glow Accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Creator & Brand Badge */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 max-w-xl">
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 shadow-inner shrink-0">
              <Logo size="lg" showText={false} />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
                <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 inline" />
                <span>Made with ❤️ by Satyam Ray</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black tracking-tight font-['Outfit'] text-white">
                Free, Private & Fast Tools for Everyone
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                "This free tool has been created and made available for everyone by <strong className="text-indigo-300 font-bold">Satyam Ray</strong>. Thank you for using our platform. We hope these tools help make your work faster, easier, and more productive."
              </p>
            </div>
          </div>

          {/* Trust Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto shrink-0">
            <div className="p-3.5 bg-slate-800/60 backdrop-blur-xs rounded-2xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>100% Free</span>
              </div>
              <p className="text-[11px] text-slate-400">No subscriptions or hidden limits</p>
            </div>

            <div className="p-3.5 bg-slate-800/60 backdrop-blur-xs rounded-2xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold">
                <Zap className="w-4 h-4" />
                <span>In-Browser</span>
              </div>
              <p className="text-[11px] text-slate-400">Private client-side processing</p>
            </div>

            <div className="p-3.5 bg-slate-800/60 backdrop-blur-xs rounded-2xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                <Star className="w-4 h-4" />
                <span>High Quality</span>
              </div>
              <p className="text-[11px] text-slate-400">Precision document engine</p>
            </div>

            <div className="p-3.5 bg-slate-800/60 backdrop-blur-xs rounded-2xl border border-slate-700/60 space-y-1">
              <div className="flex items-center gap-1.5 text-teal-400 text-xs font-bold">
                <Globe className="w-4 h-4" />
                <span>Open Access</span>
              </div>
              <p className="text-[11px] text-slate-400">Accessible across all devices</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
