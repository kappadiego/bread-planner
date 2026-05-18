/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
