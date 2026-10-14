/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', '"Fira Code"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        codex: {
          bg: '#090A0F',
          sidebar: '#0E1017',
          panel: '#12151E',
          card: '#171B26',
          border: '#222736',
          accent: '#10A37F',
          blue: '#3B82F6',
        }
      }
    },
  },
  plugins: [],
};
