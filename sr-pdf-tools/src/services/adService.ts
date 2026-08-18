import { AdPosition, AdSlotConfig, YouTubePromoConfig } from '../types';

const AD_STORAGE_KEY = 'filemaster_ad_configs_v1';
const YOUTUBE_STORAGE_KEY = 'filemaster_youtube_config_v1';

export const DEFAULT_AD_SLOTS: AdSlotConfig[] = [
  {
    id: 'header-ad',
    title: 'Header Banner',
    position: 'header',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Displays at the top of every page under the main navigation bar (728x90 / responsive leaderboard).',
  },
  {
    id: 'homepage-top-ad',
    title: 'Homepage Top Ad',
    position: 'homepage-top',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Above the tools grid on the homepage.',
  },
  {
    id: 'tool-top-ad',
    title: 'Tool Page Top Ad',
    position: 'tool-top',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Top of active tool workspace before the upload card.',
  },
  {
    id: 'image-tools-ad',
    title: 'Image Tools Exclusive Ad',
    position: 'image-tools',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Shown inside Image Converter, Compressor, and Image Editor.',
  },
  {
    id: 'pdf-tools-ad',
    title: 'PDF Tools Exclusive Ad',
    position: 'pdf-tools',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Shown inside PDF Merge, Split, Convert, and Compress tools.',
  },
  {
    id: 'between-content-ad',
    title: 'Between Content Ad',
    position: 'between-content',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Between tool sections and feature highlight cards.',
  },
  {
    id: 'result-top-ad',
    title: 'Conversion Result Top Ad',
    position: 'result-top',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Prominently above the conversion success metrics card.',
  },
  {
    id: 'before-download-ad',
    title: 'Download Area Ad',
    position: 'before-download',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Placed clearly below the metrics, separated cleanly from the Download action button.',
  },
  {
    id: 'sidebar-ad',
    title: 'Sidebar Ad (Desktop)',
    position: 'sidebar',
    enabled: true,
    device: 'desktop',
    adCode: '',
    notes: 'Right-side rail on wide desktop screens (300x250 or 300x600 sticky).',
  },
  {
    id: 'mobile-ad',
    title: 'Mobile Bottom Sticky Ad',
    position: 'mobile',
    enabled: true,
    device: 'mobile',
    adCode: '',
    notes: 'Optimized 320x50 mobile banner.',
  },
  {
    id: 'footer-ad',
    title: 'Footer Ad',
    position: 'footer',
    enabled: true,
    device: 'all',
    adCode: '',
    notes: 'Above the footer links and copyright block.',
  },
];

export const DEFAULT_YOUTUBE_CONFIG: YouTubePromoConfig = {
  enabled: true,
  videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // placeholder demo, customizable in admin
  channelUrl: 'https://youtube.com/@FileMasterTools',
  title: 'Watch Step-by-Step Video Tutorials',
  description: 'Learn how to compress images down to 50KB, batch convert multiple PDFs, and edit photos in your browser.',
  buttonText: 'Subscribe on YouTube',
};

export function getSavedAdConfigs(): AdSlotConfig[] {
  try {
    const saved = localStorage.getItem(AD_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with default list in case new positions were added
      return DEFAULT_AD_SLOTS.map((def) => {
        const found = parsed.find((p: AdSlotConfig) => p.id === def.id || p.position === def.position);
        return found ? { ...def, ...found } : def;
      });
    }
  } catch (e) {
    console.warn('Failed to load ad configs from localStorage:', e);
  }
  return DEFAULT_AD_SLOTS;
}

export function saveAdConfigs(configs: AdSlotConfig[]): void {
  try {
    localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(configs));
  } catch (e) {
    console.error('Failed to save ad configs:', e);
  }
}

export function getSavedYouTubeConfig(): YouTubePromoConfig {
  try {
    const saved = localStorage.getItem(YOUTUBE_STORAGE_KEY);
    if (saved) return { ...DEFAULT_YOUTUBE_CONFIG, ...JSON.parse(saved) };
  } catch (e) {
    console.warn('Failed to load youtube config:', e);
  }
  return DEFAULT_YOUTUBE_CONFIG;
}

export function saveYouTubeConfig(config: YouTubePromoConfig): void {
  try {
    localStorage.setItem(YOUTUBE_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save youtube config:', e);
  }
}
