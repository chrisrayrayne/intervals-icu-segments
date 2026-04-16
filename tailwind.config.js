/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        surface: '#13131a',
        border: '#1e1e2e',
        accent: '#00c87a',
        'accent-dim': '#00a363',
        text: '#e8e8f0',
        muted: '#6b6b80',
        danger: '#ff4d6d',
        warning: '#ffd166',
      },
    },
  },
  plugins: [],
};
