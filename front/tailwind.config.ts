import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0f172a",
          900: "#111827",
          800: "#1f2937",
        },
      },
      boxShadow: {
        soft: "0 12px 28px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
