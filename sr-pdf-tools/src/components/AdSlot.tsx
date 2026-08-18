import React, { useEffect, useRef } from 'react';
import { AdPosition } from '../types';
import { getSavedAdConfigs } from '../services/adService';
import { Layers } from 'lucide-react';

interface AdSlotProps {
  position: AdPosition;
  className?: string;
}

export const AdSlot: React.FC<AdSlotProps> = ({ position, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const configs = getSavedAdConfigs();
  const slot = configs.find((s) => s.position === position);

  useEffect(() => {
    if (slot?.enabled && slot.adCode && containerRef.current) {
      containerRef.current.innerHTML = '';
      
      try {
        const range = document.createRange();
        range.selectNode(containerRef.current);
        const fragment = range.createContextualFragment(slot.adCode);
        containerRef.current.appendChild(fragment);
      } catch (err) {
        console.error('Error rendering ad code in slot:', position, err);
      }
    }
  }, [slot?.enabled, slot?.adCode, position]);

  if (!slot || !slot.enabled) {
    return null;
  }

  // Device filtering classes
  const deviceClass =
    slot.device === 'desktop'
      ? 'hidden md:block'
      : slot.device === 'mobile'
      ? 'block md:hidden'
      : 'block';

  return (
    <div
      id={`ad-slot-${position}`}
      className={`w-full my-4 flex flex-col items-center justify-center transition-all ${deviceClass} ${className}`}
    >
      <div className="w-full max-w-4xl bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl p-3 sm:p-4 text-center overflow-hidden">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-1 mb-1.5">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            Advertisement
          </span>
        </div>

        {slot.adCode ? (
          <div
            ref={containerRef}
            className="w-full min-h-[60px] flex items-center justify-center overflow-auto"
          />
        ) : (
          <div className="py-3 px-3 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <span className="text-[11px]">Sponsored Space</span>
          </div>
        )}
      </div>
    </div>
  );
};
