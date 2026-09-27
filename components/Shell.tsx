"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, FileText, Key, Languages, LogOut, MessageSquare, Printer, Users } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user";
import LoginScreen from "@/components/LoginScreen";

const nav = [
  { href: "/chat", label: "Chat AI", icon: MessageSquare },
  { href: "/groups", label: "Guruhlar", icon: Users },
  { href: "/homework", label: "Vazifalar", icon: ClipboardList },
  { href: "/logins", label: "Loginlar", icon: Key },
  { href: "/files", label: "Fayllar", icon: FileText },
  { href: "/vocabulary", label: "Lug'at", icon: Languages },
  { href: "/print", label: "Print", icon: Printer },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { teacher, logout, loading } = useCurrentUser();

  if (loading) return null;
  if (!teacher) return <LoginScreen />;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-gradient-to-b from-brand-dark via-brand-dark to-[#062E2B] text-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-light to-brand shadow-lift">
            <BookOpen className="h-5 w-5 text-white" aria-hidden />
          </span>
          <div className="leading-tight">
            <span className="block text-base font-bold tracking-tight">Cosmos AI</span>
            <span className="block text-xs text-white/50">O'qituvchi paneli</span>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Asosiy menyu">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/15 font-semibold text-white shadow-sm ring-1 ring-white/10"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-light" aria-hidden />}
                <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-light" : "text-white/60 group-hover:text-white"}`} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden p-3 md:absolute md:bottom-0 md:block md:w-64">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-light to-brand text-sm font-bold">
              {teacher.name.trim().charAt(0).toUpperCase()}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{teacher.name}</p>
            <button
              onClick={logout}
              className="shrink-0 rounded-lg p-2 text-red-400 transition hover:bg-red-500/15 hover:text-red-300"
              aria-label="Chiqish"
              title="Chiqish"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-10">{children}</main>
    </div>
  );
}
