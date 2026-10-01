"use client";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Wand2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { fetchCategories, fetchFiles, type FileCategory, type FileRow } from "@/lib/files";
import { fetchSetWords, fetchVocabularySets, type VocabSet, type VocabWord } from "@/lib/vocabulary";
import { peek, swr } from "@/lib/cache";
import { isoOfTimestamp } from "@/lib/dates";

const formatDate = (ts: string) => {
  const iso = isoOfTimestamp(ts);
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
};

export default function VocabularyPage() {
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileId, setFileId] = useState("");
  const [topic, setTopic] = useState("");
  const [sets, setSets] = useState<VocabSet[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wordsBySet, setWordsBySet] = useState<Record<string, VocabWord[]>>({});
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingWords, setLoadingWords] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    swr("categories", fetchCategories, (cats) => {
      setCategories(cats);
      setCategoryId((prev) => prev || cats[0]?.id || "");
    }).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!categoryId) return;
    let active = true;
    const key = `files:${categoryId}`;
    setLoadingFiles(peek(key) === undefined);
    swr(key, () => fetchFiles(categoryId), (rows) => {
      setFiles(rows);
      setFileId((prev) => (rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? ""));
    }, () => active)
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoadingFiles(false));
    return () => {
      active = false;
    };
  }, [categoryId]);

  const loadSets = async () => {
    try {
      await swr("vocab-sets", fetchVocabularySets, setSets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lug'atlarni yuklashda xato.");
    } finally {
      setLoadingSets(false);
    }
  };

  useEffect(() => {
    setLoadingSets(peek("vocab-sets") === undefined);
    loadSets();
  }, []);

  const toggleSet = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    const key = `vocab-words:${id}`;
    const cached = peek<VocabWord[]>(key);
    if (cached) setWordsBySet((prev) => ({ ...prev, [id]: cached }));
    setLoadingWords(!cached);
    try {
      await swr(key, () => fetchSetWords(id), (words) => setWordsBySet((prev) => ({ ...prev, [id]: words })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "So'zlarni yuklashda xato.");
    } finally {
      setLoadingWords(false);
    }
  };

  const extract = async () => {
    if (!fileId) {
      setError("Avval fayl tanlang.");
      return;
    }
    setExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Xatolik yuz berdi.");
      setTopic("");
      await loadSets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI bilan bog'lanishda xatolik.");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <>
      <PageHeader title="Lug'at" hint="Fayl va (ixtiyoriy) mavzuni tanlang — AI shu mavzuga oid so'zlarni PDF ichidan ajratib beradi va natija pastdagi ro'yxatga qo'shiladi." />

      <section className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4">
        <label className="text-sm">
          Bo'lim
          <select className="mt-1.5 block" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Fayl
          {loadingFiles ? (
            <p className="mt-1 text-xs text-ink-soft">Yuklanmoqda...</p>
          ) : files.length === 0 ? (
            <p className="mt-1 text-xs text-ink-soft">Bu bo'limda fayl yo'q</p>
          ) : (
            <select className="mt-1.5 block" value={fileId} onChange={(e) => setFileId(e.target.value)}>
              {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
        </label>
        <label className="text-sm">
          Mavzu (ixtiyoriy)
          <input className="mt-1.5 block" value={topic} placeholder="Masalan, Environment" onChange={(e) => setTopic(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={extracting || !fileId} onClick={extract}>
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
          Lug'atni ajratish
        </button>
      </section>

      {error && <p role="alert" className="mb-4 rounded-xl bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      {loadingSets ? (
        <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Yuklanmoqda...</p>
      ) : sets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">Hali lug'at ajratilmagan.</p>
      ) : (
        <ul className="space-y-3">
          {sets.map((set) => {
            const open = openId === set.id;
            const words = wordsBySet[set.id];
            return (
              <li key={set.id} className="rounded-xl border border-line bg-card">
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  aria-expanded={open}
                  onClick={() => toggleSet(set.id)}
                >
                  {open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{set.topic || set.fileName || "Mavzusiz lug'at"}</span>
                    {set.topic && set.fileName && <span className="block truncate text-xs text-ink-soft">{set.fileName}</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-ink-soft">
                    <span className="block">{formatDate(set.createdAt)}</span>
                    <span className="block">{set.wordCount} ta so'z</span>
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-line">
                    {!words || loadingWords ? (
                      <p className="flex items-center gap-2 p-4 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Yuklanmoqda...</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-paper text-ink-soft">
                          <tr>
                            <th className="p-3 font-medium">So'z</th>
                            <th className="p-3 font-medium">Tarjima</th>
                            <th className="p-3 font-medium">Misol</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {words.map((w, i) => (
                            <tr key={`${w.word}-${i}`}>
                              <td className="p-3 font-medium">{w.word}</td>
                              <td className="p-3">{w.translation}</td>
                              <td className="p-3 text-ink-soft">{w.example}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
