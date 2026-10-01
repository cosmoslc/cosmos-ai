"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { totalAudioSeconds, uploadHomeworkAudio, type AudioFile } from "@/lib/homework";

export function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Tinglash vazifasi uchun audio fayllar: birma-bir yuklanadi, ijro tartibi qo'lda sozlanadi.
export default function AudioListEditor({ files, onChange }: { files: AudioFile[]; onChange: (files: AudioFile[]) => void }) {
  const latest = useRef(files);
  useEffect(() => {
    latest.current = files;
  }, [files]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = (next: AudioFile[]) => {
    latest.current = next;
    onChange(next);
  };

  const onPick = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const list = Array.from(picked);
    setError(null);
    // Har bir fayl navbat bilan yuklanadi va yuklanishi bilan ro'yxat oxiriga qo'shiladi.
    for (let i = 0; i < list.length; i++) {
      setProgress(`Yuklanmoqda ${i + 1}/${list.length}: ${list[i].name}`);
      try {
        commit([...latest.current, await uploadHomeworkAudio(list[i])]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yuklashda xato.");
        break;
      }
    }
    setProgress(null);
  };

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  return (
    <div className="mt-2 space-y-2">
      {files.length > 0 && (
        <ol className="space-y-1">
          {files.map((f, i) => (
            <li key={f.url} className="flex items-center gap-2 rounded-lg border border-line bg-card px-2 py-1 text-sm">
              <span className="w-5 text-center text-xs text-ink-soft">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-ink-soft">{fmtDuration(f.duration_seconds)}</span>
              <button type="button" className="text-ink-soft hover:text-brand disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Yuqoriga">
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="text-ink-soft hover:text-brand disabled:opacity-30" disabled={i === files.length - 1} onClick={() => move(i, 1)} aria-label="Pastga">
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="text-ink-soft hover:text-danger" onClick={() => commit(files.filter((_, k) => k !== i))} aria-label="Audioni olib tashlash">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`btn-ghost cursor-pointer ${progress ? "pointer-events-none opacity-60" : ""}`}>
          {progress ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          Audio yuklash
          <input type="file" accept="audio/*" multiple className="sr-only" disabled={!!progress} onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
        </label>
        {files.length > 0 && <span className="text-xs text-ink-soft">Jami: {fmtDuration(totalAudioSeconds(files))} · tartibni ↑↓ bilan sozlang</span>}
        {progress && <span className="text-xs text-ink-soft">{progress}</span>}
      </div>
      {files.length === 0 && (
        <p className="text-xs text-ink-soft">
          Audio yuklamasangiz (masalan, maxfiy Telegram kanal uchun), vaqtni o'zingiz belgilang: o'quvchi telefonida istalgan ilovada (Telegram, YouTube...) audio
          ijro etilgan vaqtdagina hisoblanadi.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
