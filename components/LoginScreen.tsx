"use client";
import { useState } from "react";
import { BookOpen, Loader2, LogIn } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user";

export default function LoginScreen() {
  const { login } = useCurrentUser();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await login(phone, password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-dark via-brand to-brand-light p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-xl border border-white/40 bg-card p-8 shadow-lift">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-light to-brand shadow-soft">
            <BookOpen className="h-5 w-5 text-white" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold">Cosmos AI</h1>
        </div>
        <p className="text-sm text-ink-soft">O'qituvchi sifatida telefon raqami va parol bilan kiring.</p>

        {error && <p role="alert" className="rounded-md bg-danger-tint p-3 text-sm text-danger">{error}</p>}

        <label className="block">
          <span className="mb-1 block text-sm">Telefon raqami</span>
          <input
            className="w-full"
            type="tel"
            autoComplete="username"
            placeholder="90 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Parol</span>
          <input
            className="w-full"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogIn className="h-4 w-4" aria-hidden />}
          Kirish
        </button>
      </form>
    </div>
  );
}
