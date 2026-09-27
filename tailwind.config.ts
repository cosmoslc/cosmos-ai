import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F7FA",
        card: "#FFFFFF",
        ink: { DEFAULT: "#172033", soft: "#5A6578", faint: "#8B95A7" },
        line: "#E4E8EF",
        brand: { DEFAULT: "#0F766E", dark: "#0B4F4A", light: "#14B8A6", tint: "#E6F6F4" },
        amber: { DEFAULT: "#D97706", tint: "#FEF3C7" },
        danger: { DEFAULT: "#DC2626", tint: "#FEE9E7" },
      },
      borderRadius: { md: "0.625rem", lg: "0.875rem", xl: "1.25rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(23,32,51,0.04), 0 4px 16px rgba(23,32,51,0.06)",
        lift: "0 2px 4px rgba(23,32,51,0.06), 0 12px 28px rgba(23,32,51,0.10)",
      },
      fontFamily: { sans: ["var(--font-onest)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
