/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#163322',
          light: '#20482f',
          dark: '#0c1e15',
        },
        leaf: {
          DEFAULT: '#65D693',
          light: '#8ee8b1',
          dark: '#3aaa68',
        },
        teal: {
          DEFAULT: '#48C4D8',
          light: '#6dd4e3',
          dark: '#2ba8bc',
        },
        // On white background, "cream" becomes dark ink so all text-cream/* classes
        // automatically produce correct contrast without touching every component.
        cream: '#111827',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Source Sans Pro"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'tree-pop': 'tree-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'fade-up': 'fade-up 0.5s ease-out both',
        shimmer: 'shimmer 1.8s linear infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
      keyframes: {
        'tree-pop': {
          '0%': { opacity: '0', transform: 'scale(0) rotate(-15deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(0.8)', opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
