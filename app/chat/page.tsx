"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Send } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useCurrentUser } from "@/lib/current-user";
import { fetchGroupsForTeacher, type GroupRow } from "@/lib/groups";
import { getOrCreateSession, fetchMessages, type ChatMessage } from "@/lib/chat";
import { fetchAllFiles, fetchCategories, type FileCategory, type FileRow } from "@/lib/files";

const quick = [
  "Ertangi dars uchun reja tuz",
  "Shu hafta uchun reja tuz",
  "Keyingi hafta uchun reja tuz",
  "Keyingi hafta uchun Reading, Listening, Writing, Speaking bo'limlarini ketma-ket qilib reja tuz",
  "Qayergacha o'tdik?",
];

const storageKey = (groupId: string) => `cosmos_chat_files_${groupId}`;

export default function ChatPage() {
  const { teacher } = useCurrentUser();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupId, setGroupId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teacher) return;
    fetchGroupsForTeacher(teacher.id).then((rows) => {
      setGroups(rows);
      setGroupId((prev) => prev || rows[0]?.id || "");
    });
    Promise.all([fetchAllFiles(), fetchCategories()])
      .then(([f, c]) => {
        setFiles(f);
        setCategories(c);
      })
      .catch((err) => setError(err.message));
  }, [teacher]);

  useEffect(() => {
    if (!teacher || !groupId) return;
    let active = true;
    setLoading(true);
    try {
      setSelected(JSON.parse(localStorage.getItem(storageKey(groupId)) ?? "[]"));
    } catch {
      setSelected([]);
    }
    (async () => {
      const sid = await getOrCreateSession(teacher.id, groupId);
      if (!active) return;
      setSessionId(sid);
      const history = await fetchMessages(sid);
      if (active) setMessages(history);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [teacher, groupId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const group = groups.find((g) => g.id === groupId);

  const validSelected = selected.filter((id) => files.some((f) => f.id === id));

  const toggleFile = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    try {
      localStorage.setItem(storageKey(groupId), JSON.stringify(next));
    } catch {
      /* localStorage mavjud emas — e'tiborsiz */
    }
  };

  const send = async (q: string) => {
    if (!q.trim() || !group || !sessionId || sending) return;
    setSending(true);
    setError(null);
    setText("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          groupId: group.id,
          groupName: group.name,
          groupDays: group.days ?? [],
          groupTime: group.time ?? "",
          message: q,
          fileIds: validSelected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Xatolik yuz berdi.");
      setMessages((m) => [...m, { role: "ai", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI bilan bog'lanishda xatolik.");
      setMessages((m) => m.slice(0, -1));
      setText(q);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Chat AI"
        hint="Erkin yozing: ertangi dars, shu yoki keyingi hafta rejasi, bo'limlar ketma-ketligi, test yoki tavsiya. AI oldingi rejalarni eslab, qayerdan davom etishni o'zi biladi."
      >
        {groups.length > 0 && (
          <select aria-label="Guruh" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </PageHeader>

      {error && <p role="alert" className="mb-4 rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

      <section className="flex h-[65vh] flex-col rounded-lg border border-line bg-card">
        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Yuklanmoqda...</p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-ink-soft">Xohlagan so'rovingizni yozing yoki tayyor so'rovlardan birini tanlang.</p>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {quick.map((q) => <button key={q} className="btn-ghost" onClick={() => send(q)}>{q}</button>)}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
                <p className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-brand text-white" : "bg-paper"}`}>{m.content}</p>
              </div>
            ))
          )}
          {sending && (
            <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />AI o'ylayapti...</p>
          )}
          <div ref={end} />
        </div>

        <details className="border-t border-line px-3 py-2 text-sm">
          <summary className="flex cursor-pointer select-none items-center gap-2 text-ink-soft">
            <FileText className="h-4 w-4" aria-hidden />
            Materiallar ({validSelected.length} ta tanlandi) — bet raqamlari aniq bo'lishi uchun kerakli PDF ni tanlang
          </summary>
          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {files.length === 0 && <p className="text-ink-soft">Hali fayl yuklanmagan (Fayllar bo'limi).</p>}
            {categories.map((c) => {
              const list = files.filter((f) => f.category_id === c.id);
              if (list.length === 0) return null;
              return (
                <div key={c.id}>
                  <p className="text-xs font-semibold text-ink-soft">{c.name}</p>
                  {list.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 py-0.5">
                      <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggleFile(f.id)} />
                      <span className="truncate">{f.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </details>

        <div className="flex gap-2 border-t border-line p-3">
          <input
            className="flex-1"
            value={text}
            placeholder="Masalan: keyingi haftaga reja tuz"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(text)}
          />
          <button className="btn-primary" onClick={() => send(text)} aria-label="Yuborish" disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </section>
    </>
  );
}
