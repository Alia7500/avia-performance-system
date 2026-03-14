/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- ДОБАВЬ ЭТО: позволяет переключать тему через класс 'dark'
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}