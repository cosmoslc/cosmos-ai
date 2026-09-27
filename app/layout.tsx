import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { CurrentUserProvider } from "@/lib/current-user";
import Shell from "@/components/Shell";

const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest" });

export const metadata: Metadata = { title: "Cosmos AI", description: "EduCRM AI moduli" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={onest.variable}>
      <body className="font-sans">
        <CurrentUserProvider>
          <Shell>{children}</Shell>
        </CurrentUserProvider>
      </body>
    </html>
  );
}
