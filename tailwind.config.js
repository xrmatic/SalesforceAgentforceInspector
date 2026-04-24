/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        salesforce: {
          blue: '#0070d2',
          dark: '#16325c',
          light: '#f4f6f9',
        },
      },
    },
  },
  plugins: [],
}
