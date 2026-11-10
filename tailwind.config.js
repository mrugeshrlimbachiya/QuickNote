/** @type {import('tailwindcss').Config} */
export default {
  // Include ALL source files so Tailwind can tree-shake unused classes
  content: [
    "./src/**/*.{tsx,ts,jsx,js,html}",
    "./src/popup/popup.html",
  ],
  darkMode: "media", // Respects OS dark mode preference
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter"',
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      boxShadow: {
        "float": "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        "float-dark": "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-in": "slideIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
