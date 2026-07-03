import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        border: v("border"),
        muted: v("muted"),
        silver: v("silver"),
        accent: v("accent"),
        accentHover: v("accentHover"),
        accentLight: v("surface"),
        accentDark: v("accentDark"),
        highlight: v("highlight"),
        brand: v("highlight"),
        brandHover: v("accent"),
        primary: v("primary"),
        primaryHover: v("accent"),
        secondary: v("secondary"),
        tertiary: v("tertiary"),
        borderDefault: v("border"),
        borderHover: v("borderHover"),
        borderInner: v("border"),
        bgPage: v("bg"),
        bgHover: v("bgHover"),
        bgActive: v("bgActive"),
        bgCard: v("bgCard"),
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#EAB308",
        sidebar: v("sidebar"),
        sidebarHover: v("sidebarHover"),
        sidebarActive: v("highlight"),
        sidebarText: v("sidebarText"),
        sidebarTextActive: v("bg"),
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        display: ["48px", { lineHeight: "1.1", fontWeight: "500", letterSpacing: "0" }],
        h1: ["22px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0" }],
        h2: ["16px", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "0" }],
        h3: ["14px", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["14px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.5" }],
      },
      boxShadow: {
        card: "none",
        "card-hover": "0 16px 40px -30px rgba(0,0,0,0.35)",
        subtle: "none",
      },
      borderRadius: {
        btn: "8px",
        card: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;
