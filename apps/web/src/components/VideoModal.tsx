import React, { useState } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, CheckCircle, Info } from 'lucide-react';
import { VideoMaterial } from '../types';
import { useI18n } from '../i18n/I18nProvider';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoMaterial | null;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, video }) => {
  const { t } = useI18n();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chapters'>('overview');

  if (!isOpen || !video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#07130D]/90 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-[#111814] text-white border border-white/15 shadow-2xl z-10 overflow-hidden my-4">
        {/* Header bar */}
        <div className="bg-[#0A2617] px-6 py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="font-tech text-xs tracking-widest text-[#D4B982] uppercase">
              {t(video.category)}
            </span>
            <span className="text-white/30">|</span>
            <span className="text-xs text-white/80 font-medium truncate max-w-sm sm:max-w-md">
              {t(video.title)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1"
            aria-label={t("Close video")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden group">
          <img
            src={video.thumbnail}
            alt={t(video.title)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85 group-hover:scale-102 transition-transform duration-700"
          />

          {/* Technical overlay grid hairlines */}
          <div className="absolute inset-0 pointer-events-none border border-white/10 m-3 sm:m-6" />

          {/* Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

          {/* Center Play/Pause state */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 bg-[#0E482C]/90 hover:bg-[#0E482C] border border-[#D4B982]/40 rounded-full flex items-center justify-center text-white transition-transform transform hover:scale-105 shadow-2xl"
            aria-label={isPlaying ? t("Pause video presentation") : t("Play video presentation")}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
            ) : (
              <Play className="w-7 h-7 sm:w-8 sm:h-8 ml-1 fill-current text-[#D4B982]" />
            )}
          </button>

          {/* Player controls bottom bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-4 sm:p-6 flex flex-col gap-2 z-10">
            {/* Progress bar */}
            <div className="w-full bg-white/20 h-1 rounded overflow-hidden cursor-pointer">
              <div className="bg-[#B89758] h-full w-2/5 transition-all duration-300" />
            </div>

            <div className="flex items-center justify-between text-xs font-tech text-white/80 pt-1">
              <div className="flex items-center gap-4">
                <span className="text-[#D4B982]">03:24 / {t(video.duration)}</span>
                <span className="text-white/40">|</span>
                <span className="tracking-wider">{t(video.resolution)}</span>
                <span className="text-white/40 hidden sm:inline">|</span>
                <span className="text-white/60 hidden sm:inline">{t(video.tag)}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1 hover:text-white transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button className="p-1 hover:text-white transition-colors">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Video Information Panel */}
        <div className="p-6 bg-[#0E1511] border-t border-white/10">
          <div className="flex items-center gap-4 mb-3 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveTab('overview')}
              className={`text-xs font-tech tracking-wider uppercase pb-1 transition-colors ${
                activeTab === 'overview'
                  ? 'text-[#D4B982] border-b-2 border-[#D4B982]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {t("Documentary Overview")}
            </button>
            <button
              onClick={() => setActiveTab('chapters')}
              className={`text-xs font-tech tracking-wider uppercase pb-1 transition-colors ${
                activeTab === 'chapters'
                  ? 'text-[#D4B982] border-b-2 border-[#D4B982]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {t("Key Segments & Modules")}
            </button>
          </div>

          {activeTab === 'overview' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <h4 className="text-lg font-bold text-white mb-2">{t(video.title)}</h4>
                <p className="text-sm text-white/70 leading-relaxed">{t(video.description)}</p>
              </div>
              <div className="bg-white/5 p-3.5 border border-white/10 space-y-2 text-xs font-tech text-white/70">
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>{t("FORMAT:")}</span>
                  <span className="text-white">{t("Technical 4K Documentary")}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>{t("PRODUCER:")}</span>
                  <span className="text-white">{t("Soltex EPCM Media Group")}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("FIELD AUDIT:")}</span>
                  <span className="text-[#D4B982]">{t("Verified Facility Footage")}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { time: '00:00 - 02:30', title: 'Plant Engineering & Layout', desc: '3D BIM models vs. built factory reality' },
                { time: '02:31 - 05:45', title: 'Extraction & Separation', desc: 'Continuous alcohol-free extraction process' },
                { time: '05:46 - 08:15', title: 'Automation & SCADA Control', desc: 'Clean-in-place & real-time monitoring' },
                { time: '08:16 - END', title: 'Finished Product Output', desc: 'Packaging, purity tests & laboratory verification' }
              ].map((chapter, i) => (
                <div key={i} className="bg-white/5 p-3 border border-white/10">
                  <span className="font-tech text-[#D4B982] block mb-1">{t(chapter.time)}</span>
                  <p className="font-semibold text-white mb-1">{t(chapter.title)}</p>
                  <p className="text-white/60 text-[11px]">{t(chapter.desc)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
