/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: '#0a0a0f',
          dark: '#12121a',
          gray: '#1a1a2e',
          cyan: '#00fff7',
          magenta: '#ff00ff',
          yellow: '#ffff00',
          green: '#00ff88',
          orange: '#ff8800',
          purple: '#8800ff',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        display: ['Orbitron', 'sans-serif'],
      },
      boxShadow: {
        'cyber-cyan': '0 0 20px rgba(0, 255, 247, 0.5)',
        'cyber-magenta': '0 0 20px rgba(255, 0, 255, 0.5)',
        'cyber-yellow': '0 0 20px rgba(255, 255, 0, 0.5)',
        'cyber-glow': '0 0 40px rgba(0, 255, 247, 0.3), 0 0 80px rgba(255, 0, 255, 0.2)',
      },
      animation: {
        'pulse-cyan': 'pulse-cyan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-cyan': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'scanline': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 247, 0.5), 0 0 10px rgba(0, 255, 247, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 247, 0.8), 0 0 40px rgba(0, 255, 247, 0.5)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0, 255, 247, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 247, 0.03) 1px, transparent 1px)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
}

