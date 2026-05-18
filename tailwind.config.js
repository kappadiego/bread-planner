/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        flour: '#f8f5ef',
        wheat: {
          50: '#fffaf0',
          100: '#f7edcf',
          200: '#ebd08e',
          400: '#d9a642',
          600: '#ad741e',
        },
        proof: {
          50: '#edf7f1',
          100: '#d7ecdf',
          600: '#26784d',
          700: '#1d5f3d',
        },
        ink: '#1f2522',
      },
      boxShadow: {
        soft: '0 18px 60px rgba(31, 37, 34, 0.08)',
        air: '0 14px 42px rgba(31, 37, 34, 0.08)',
        'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(31,37,34,0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
