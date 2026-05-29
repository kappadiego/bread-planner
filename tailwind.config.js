/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        flour: '#fff8ef',
        cream: '#f9e8d3',
        sage: '#8ea06d',
        crust: '#b26837',
        ink: '#322e2b',
        wheat: {
          50: '#fff7e8',
          100: '#f7e4bc',
          200: '#efd092',
          400: '#e0ae63',
          600: '#b9792c',
        },
        proof: {
          50: '#f3f6ec',
          100: '#e1e8d1',
          600: '#8ea06d',
          700: '#68794f',
        },
      },
      boxShadow: {
        soft: '0 18px 60px rgba(50, 46, 43, 0.08)',
        air: '0 14px 42px rgba(50, 46, 43, 0.08)',
        'inner-soft': 'inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(50,46,43,0.04)',
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
