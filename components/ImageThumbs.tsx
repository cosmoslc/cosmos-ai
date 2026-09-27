"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// O'quvchi yuklagan rasmlar: kichik ko'rinishda (preview), bosilganda shu sahifaning
// o'zida kattalashtirib ochiladi — boshqa sahifaga/havolaga o'tmaydi.
export default function ImageThumbs({ urls, size = 48 }: { urls: string[]; size?: number }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % urls.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + urls.length) % urls.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, urls.length]);

  if (urls.length === 0) return null;

  return (
    <>
      <span className="inline-flex flex-wrap gap-1.5">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(i);
            }}
            className="overflow-hidden rounded border border-line bg-paper hover:ring-2 hover:ring-brand/40"
            style={{ width: size, height: size }}
            aria-label={`Rasm ${i + 1} ni ko'rish`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </span>

      {open !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setOpen(null)}
            aria-label="Yopish"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          {urls.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((open - 1 + urls.length) % urls.length);
                }}
                aria-label="Oldingi rasm"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <button
                type="button"
                className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((open + 1) % urls.length);
                }}
                aria-label="Keyingi rasm"
              >
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[open]}
            alt={`Rasm ${open + 1}`}
            className="max-h-[90vh] max-w-[92vw] rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {urls.length > 1 && (
            <span className="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {open + 1} / {urls.length}
            </span>
          )}
        </div>
      )}
    </>
  );
}
