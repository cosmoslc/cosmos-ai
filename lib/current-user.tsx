"use client";
// O'qituvchi asosiy (CRM) loyihadagi teachers_hr jadvalidagi telefon +
// parol (SHA-256) bilan kiradi. Sessiya brauzerda (localStorage) saqlanadi.
// ESLATMA: bu client-side tekshiruv — haqiqiy Supabase Auth emas.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

export type Teacher = { id: string; name: string };

type Ctx = {
  teacher: Teacher | null;
  login: (phone: string, password: string) => Promise<string | null>;
  logout: () => void;
  loading: boolean;
};

const STORAGE_KEY = "cosmos_teacher";
const CurrentUserContext = createContext<Ctx | null>(null);

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTeacher(JSON.parse(raw) as Teacher);
    } catch {
      /* buzilgan qiymat — e'tiborsiz */
    }
    setLoading(false);
  }, []);

  // Xato matnini qaytaradi, muvaffaqiyatda null.
  const login = useCallback(async (phone: string, password: string): Promise<string | null> => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 9 || !password) return "Telefon raqami va parolni kiriting.";

    const { data, error } = await supabase
      .from("teachers_hr")
      .select("id, name, phone, password_hash")
      .eq("role", "teacher");
    if (error) return error.message;

    const match = (data ?? []).find((t) => normalizePhone(t.phone ?? "") === normalized);
    if (!match || !match.password_hash) return "Telefon raqami yoki parol noto'g'ri.";
    if (match.password_hash !== (await sha256Hex(password))) return "Telefon raqami yoki parol noto'g'ri.";

    const t: Teacher = { id: match.id, name: match.name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    setTeacher(t);
    return null;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setTeacher(null);
  }, []);

  return (
    <CurrentUserContext.Provider value={{ teacher, login, logout, loading }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser CurrentUserProvider ichida ishlatilishi kerak");
  return ctx;
}
