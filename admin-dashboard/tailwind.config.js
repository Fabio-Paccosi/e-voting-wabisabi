/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          primary: '#3B82F6',
          secondary: '#6366F1',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444'
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
