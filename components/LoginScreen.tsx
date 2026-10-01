"use client";
import { useState } from "react";
import { ArrowRight, BookOpen, Eye, EyeOff } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user";

const PHONE_LENGTH = 9;

// "901234567" -> "90 123 45 67"
function formatPhone(digits: string): string {
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}

// Guruh ichidagi inputlar global input uslubidan tozalanadi: border va halqa tashqi qutida turadi
const BARE_INPUT =
  "w-full rounded-none border-0 bg-transparent px-3.5 py-2.5 text-sm font-medium text-ink shadow-none placeholder:text-ink-faint focus:ring-0 focus:outline-hidden";

export default function LoginScreen() {
  const { login } = useCurrentUser();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneIncomplete = phone.length > 0 && phone.length < PHONE_LENGTH;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < PHONE_LENGTH) {
      setError("Telefon raqamingizni to'liq kiriting.");
      return;
    }
    if (!password) {
      setError("Parolni kiriting.");
      return;
    }
    setBusy(true);
    setError(null);
    const err = await login(phone, password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-paper p-4 text-ink sm:p-6">
      {/* Fon yoritgichlari */}
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-brand-light/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/3 h-[450px] w-[450px] translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,247,250,0.5)_0%,rgba(228,232,239,0.9)_100%)]" />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-white/90 p-6 shadow-2xl shadow-ink/10 backdrop-blur-2xl sm:p-8">
        {/* Sarlavha */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-1 flex flex-col items-center gap-1.5">
            <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient shadow-lg shadow-brand/30 ring-4 ring-brand/10">
              <BookOpen className="h-7 w-7 text-white" aria-hidden />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Cosmos AI</h1>
            <span className="rounded-full border border-brand/20 bg-brand-tint px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
              O'qituvchi paneli
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">Telefon raqami va parol bilan kiring</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-phone" className="mb-1.5 block text-xs font-bold text-ink">
              Telefon raqam
            </label>
            <div
              className={`flex items-center overflow-hidden rounded-xl border bg-paper transition-all focus-within:ring-2 ${
                phoneIncomplete
                  ? "border-danger focus-within:border-danger focus-within:ring-danger/20"
                  : "border-line focus-within:border-brand focus-within:ring-brand/20"
              }`}
            >
              <span className="border-r border-line bg-line/40 px-3.5 py-2.5 text-sm font-semibold text-ink-soft">+998</span>
              <input
                id="login-phone"
                className={BARE_INPUT}
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                maxLength={12}
                aria-invalid={phoneIncomplete}
                placeholder="90 123 45 67"
                value={formatPhone(phone)}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, PHONE_LENGTH));
                  setError(null);
                }}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-xs font-bold text-ink">
              Parol
            </label>
            <div className="relative flex items-center overflow-hidden rounded-xl border border-line bg-paper transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <input
                id="login-password"
                className={`${BARE_INPUT} pr-11`}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 p-1 text-ink-faint transition-colors hover:text-ink"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger-tint p-3 text-center text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                Tekshirilmoqda...
              </>
            ) : (
              <>
                Tizimga kirish
                <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
