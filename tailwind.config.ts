import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        trading: {
          blue: "#00D4FF",
          red: "#FF4466",
          green: "#00FF88",
          yellow: "#FFB800",
          panel: "#0A0A0F",
        },
        buy: "#00D4FF",
        sell: "#FF4466",
        profit: "#00FF88",
        loss: "#FF4466",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-green": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 10px rgba(0, 255, 136, 0.5)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 20px rgba(0, 255, 136, 0.8)" },
        },
        "pulse-red": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 10px rgba(255, 68, 102, 0.5)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 20px rgba(255, 68, 102, 0.8)" },
        },
        "pulse-blue": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 10px rgba(0, 212, 255, 0.5)" },
          "50%": { opacity: "0.7", boxShadow: "0 0 20px rgba(0, 212, 255, 0.8)" },
        },
        "ticker": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "flash-green": {
          "0%": { backgroundColor: "rgba(0, 255, 136, 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-red": {
          "0%": { backgroundColor: "rgba(255, 68, 102, 0.3)" },
          "100%": { backgroundColor: "transparent" },
        },
        "slide-price": {
          from: { transform: "translateY(-100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "pulse-red": "pulse-red 2s ease-in-out infinite",
        "pulse-blue": "pulse-blue 2s ease-in-out infinite",
        "ticker": "ticker 30s linear infinite",
        "flash-green": "flash-green 0.5s ease-out",
        "flash-red": "flash-red 0.5s ease-out",
        "slide-price": "slide-price 0.3s ease-out",
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
