import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  tagline?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  tagline = 'PDF & Image Tools',
  className = '',
}) => {
  // Dimensions based on size
  const iconSize = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  }[size];

  const titleSize = {
    sm: 'text-sm font-bold',
    md: 'text-base font-extrabold',
    lg: 'text-lg font-extrabold',
    xl: 'text-2xl font-black',
  }[size];

  const subSize = {
    sm: 'text-[9px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
    xl: 'text-xs',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Modern Precision SVG Vector Emblem */}
      <div
        className={`${iconSize} relative shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-0.5 shadow-md shadow-indigo-600/25 flex items-center justify-center`}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Background layered doc shadow */}
          <rect
            x="8"
            y="10"
            width="24"
            height="32"
            rx="4"
            fill="#4F46E5"
            fillOpacity="0.4"
          />
          {/* Main Primary White Document Page with Folded Corner */}
          <path
            d="M14 6H28L38 16V38C38 40.2091 36.2091 42 34 42H14C11.7909 42 10 40.2091 10 38V10C10 7.79086 11.7909 6 14 6Z"
            fill="#FFFFFF"
          />
          {/* Folded Corner Accent */}
          <path
            d="M28 6V14C28 15.1046 28.8954 16 30 16H38L28 6Z"
            fill="#EEF2FF"
          />
          <path
            d="M28 6L38 16H30C28.8954 16 28 15.1046 28 14V6Z"
            fill="#4338CA"
            fillOpacity="0.8"
          />
          
          {/* "SR" Dynamic Precision Monogram */}
          {/* S curve */}
          <path
            d="M17 21C17 19.8954 17.8954 19 19 19H25C26.1046 19 27 19.8954 27 21C27 22.1046 26.1046 23 25 23H20C18.8954 23 18 23.8954 18 25C18 26.1046 18.8954 27 20 27H26C27.1046 27 28 27.8954 28 29C28 30.1046 27.1046 31 26 31H19C17.8954 31 17 30.1046 17 29"
            stroke="#4F46E5"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* R line & loop */}
          <path
            d="M27 23H30C31.6569 23 33 24.3431 33 26C33 27.6569 31.6569 29 30 29H27V35"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M30 29L33.5 35"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Quick Action Sparkle / Lightning node */}
          <circle cx="36" cy="34" r="2.5" fill="#F59E0B" />
        </svg>
      </div>

      {/* Brand Name & Tagline */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`${titleSize} text-slate-900 tracking-tight font-['Outfit']`}
            >
              SR <span className="text-indigo-600">PDF Tools</span>
            </span>
            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
              Pro
            </span>
          </div>
          {tagline && (
            <span
              className={`${subSize} font-medium text-slate-500 tracking-normal mt-0.5`}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
