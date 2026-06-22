/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#4361ee",
        "primary-dark": "#3451d1",
        accent: "#f72585",
        success: "#06d6a0",
        warning: "#e85d04",
        danger: "#ef476f",
        navy: "#1a1a2e",
      },
    },
  },
  plugins: [],
}
