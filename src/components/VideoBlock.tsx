import React, { useEffect, useRef, useState } from 'react';
import { Play, ArrowRight, ArrowUpRight, FolderGit2, X } from 'lucide-react';
import { CompanyVideo } from '../types';
import { COMPANY_VIDEOS } from '../data/soltexData';
import { withLineBreaks } from '../i18n/translate';
import { useI18n } from '../i18n/I18nProvider';
import { Link } from '../i18n/Link';

/**
 * Homepage "Video Materials" block: the two real Soltex presentation videos + the
 * "All Projects" navigation card.
 *
 * Playback: a video with a local `src` (MP4 in /public/videos) opens in the native player
 * lightbox below; otherwise the card links to the external source in a new tab.
 */
export const VideoBlock: React.FC = () => {
  const { t } = useI18n();
  const [playing, setPlaying] = useState<CompanyVideo | null>(null);

  return (
    <section id="video-materials" className="py-14 sm:py-18 lg:py-20 bg-[#FBFBF8] border-b border-[#16211B]/10">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-[#111814] tracking-wider uppercase font-tech">
            {t("VIDEO MATERIALS")}
          </h2>
          <div className="w-12 h-[2px] bg-[#B89758] mx-auto mt-2.5" aria-hidden="true" />
        </div>

        {/* 5 + 5 + 2 cols from xl; below xl two video cards + a full-width All Projects card (the narrow column is too tight at 1024); stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-5 items-stretch">

          {COMPANY_VIDEOS.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={setPlaying} />
          ))}

          {/* All Projects navigation card */}
          <Link
            to="/projects"
            className="md:col-span-2 xl:col-span-2 bg-[#0E482C] text-white p-6 sm:p-7 xl:p-8 flex flex-col justify-between border border-[#0E482C] group hover:bg-[#0A3620] transition-colors cursor-pointer min-h-[260px] md:min-h-[230px] xl:min-h-[400px] shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B89758]"
          >
            <div>
              <div className="w-12 h-12 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center text-[#D4B982] mb-6 group-hover:scale-105 transition-transform">
                <FolderGit2 className="w-6 h-6" />
              </div>

              <h3 className="font-tech text-base sm:text-lg font-extrabold text-white tracking-wider uppercase mb-3 leading-snug">
                {withLineBreaks(t("VIEW ALL\nPROJECTS"))}
              </h3>

              <p className="text-xs sm:text-[12.5px] text-white/80 leading-relaxed font-normal">
                {t("Discover more projects and engineering success stories.")}
              </p>
            </div>

            <div className="pt-6 border-t border-white/20 flex items-center gap-2 text-[10.5px] sm:text-xs font-tech font-bold text-white uppercase tracking-wider group-hover:text-[#D4B982] transition-colors">
              <span>{t("ALL PROJECTS")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

        </div>
      </div>

      {playing && <VideoLightbox video={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
};

const cardClass =
  'xl:col-span-5 relative group overflow-hidden bg-[#111814] border border-[#16211B]/15 shadow-xs cursor-pointer flex flex-col justify-end min-h-[360px] sm:min-h-[380px] lg:min-h-[400px] text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B89758]';

const VideoCard: React.FC<{ video: CompanyVideo; onPlay: (v: CompanyVideo) => void }> = ({ video, onPlay }) => {
  const { t } = useI18n();
  const isLocal = Boolean(video.src);

  const body = (
    <>
      <img
        src={video.thumbnail}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-104 transition-transform duration-700 ease-out opacity-85"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10 pointer-events-none" />
      <div className="absolute inset-3 border border-white/15 pointer-events-none group-hover:border-white/30 transition-colors" />

      {/* Play button (decorative — the whole card is the control); centred in the space above the caption */}
      <span className="relative z-20 flex-1 flex items-center justify-center pt-8 pointer-events-none" aria-hidden="true">
        <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/60 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#0E482C] group-hover:border-[#D4B982] transition-all duration-300 shadow-xl">
          <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5 fill-white text-white group-hover:text-[#D4B982]" />
        </span>
      </span>

      <div className="relative z-10 p-5 sm:p-6 lg:p-7">
        <p className="font-tech text-xs sm:text-sm font-bold text-[#D4B982] tracking-wider uppercase mb-2">
          {video.number} / {t(video.category)}
        </p>
        <h3 className="font-tech text-base sm:text-lg lg:text-[19px] font-extrabold text-white tracking-wide uppercase leading-tight mb-3.5">
          {withLineBreaks(t(video.headline))}
        </h3>
        <p className="text-[12px] sm:text-[12.5px] text-white/80 leading-relaxed border-t border-white/15 pt-3 mb-4">
          {t(video.description)}
        </p>
        <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-tech font-bold text-white uppercase tracking-wider group-hover:text-[#D4B982] transition-colors">
          <span>{t("WATCH VIDEO")}</span>
          {isLocal ? (
            <ArrowRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:translate-x-1 transition-transform" />
          ) : (
            <ArrowUpRight className="w-3.5 h-3.5 text-[#D4B982] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          )}
        </span>
      </div>
    </>
  );

  if (isLocal) {
    return (
      <button
        type="button"
        onClick={() => onPlay(video)}
        className={cardClass}
        aria-label={t("Watch video: {title}", { title: t(video.title) })}
      >
        {body}
      </button>
    );
  }

  return (
    <a
      href={video.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClass}
      aria-label={`${t("Watch video: {title}", { title: t(video.title) })} (${t("opens in a new tab")})`}
    >
      {body}
    </a>
  );
};

/** Native HTML5 player in a lightbox — used only for locally hosted MP4 files. */
const VideoLightbox: React.FC<{ video: CompanyVideo; onClose: () => void }> = ({ video, onClose }) => {
  const { t } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t(video.title)}
    >
      <div className="absolute inset-0 bg-[#07130D]/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-black border border-white/15 shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 bg-[#0A2617] border-b border-white/10 text-white">
          <span className="font-tech text-xs tracking-widest text-[#D4B982] uppercase truncate">
            {video.number} / {t(video.category)}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1"
            aria-label={t("Close video")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <video
          src={video.src}
          poster={video.thumbnail}
          controls
          autoPlay
          playsInline
          preload="metadata"
          className="block w-full aspect-video bg-black"
        />
      </div>
    </div>
  );
};
