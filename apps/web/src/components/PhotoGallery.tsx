import { useState } from "react";
import { AuthedImage } from "./AuthedImage";

interface PhotoGalleryProps {
  srcs: string[];
  altPrefix: string;
  thumbClassName?: string;
}

export function PhotoGallery({ srcs, altPrefix, thumbClassName = "w-24 h-24" }: PhotoGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openSrc = openIndex !== null ? srcs[openIndex] : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {srcs.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpenIndex(i)}
            className={`${thumbClassName} rounded-[10px] overflow-hidden border border-line`}
          >
            <AuthedImage src={src} alt={`${altPrefix} ${i + 1}`} className="w-full h-full" />
          </button>
        ))}
      </div>

      {openIndex !== null && openSrc !== undefined && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpenIndex(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white text-xl leading-none flex items-center justify-center"
          >
            ×
          </button>
          {openIndex > 0 && (
            <button
              type="button"
              aria-label="Photo précédente"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(openIndex - 1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 text-white text-xl leading-none flex items-center justify-center"
            >
              ‹
            </button>
          )}
          {openIndex < srcs.length - 1 && (
            <button
              type="button"
              aria-label="Photo suivante"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(openIndex + 1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 text-white text-xl leading-none flex items-center justify-center"
            >
              ›
            </button>
          )}
          <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <AuthedImage
              src={openSrc}
              alt={`${altPrefix} ${openIndex + 1}`}
              fit="contain"
              className="max-w-full max-h-[85vh] w-auto h-auto"
            />
          </div>
        </div>
      )}
    </>
  );
}
