/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Matrix Green Theme - Profesional, oscuro y elegante
        matrix: {
          50: '#e8fff0',
          100: '#c3ffd6',
          200: '#8cffb3',
          300: '#4dff8e',
          400: '#1aff70',
          500: '#00e676', // Primary - Verde Matrix brillante
          600: '#00cc66',
          700: '#00a854',
          800: '#004d2a', // Más oscuro para fondos sutiles
          900: '#002e19',
        },
        dark: {
          bg: '#0a0e0a', // Fondo principal - muy oscuro con tinte verde
          surface: '#0d110d', // Superficies - ligeramente más claro
          elevated: '#111611', // Elementos elevados
          border: '#1a2e1f', // Bordes con tinte verde sutil
          text: '#e0ffe0', // Texto principal - verde muy claro
          muted: '#5a7a5a', // Texto secundario
          hover: '#162216', // Estado hover
          active: '#1a2a1a', // Estado activo
        },
        accent: {
          green: '#00e676',
          cyan: '#00ffcc',
          yellow: '#ffeb3b',
          red: '#ff5252',
          orange: '#ff9800',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-sm': '0 0 8px rgba(0, 230, 118, 0.2)',
        'glow-md': '0 0 16px rgba(0, 230, 118, 0.3)',
        'glow-lg': '0 0 24px rgba(0, 230, 118, 0.4)',
        'glow-xl': '0 0 32px rgba(0, 230, 118, 0.5)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.15s ease-out',
        'slide-up': 'slide-up 0.15s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 8px rgba(0, 230, 118, 0.2)' },
          '50%': { opacity: '0.85', boxShadow: '0 0 16px rgba(0, 230, 118, 0.35)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
