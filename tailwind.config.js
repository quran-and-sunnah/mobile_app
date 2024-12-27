/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["PoppinsRegular"],
        poppinsBold: ["PoppinsBold"],
        poppinsSemiBold: ["PoppinsSemiBold"],
      },
    },
  },
  plugins: [],
};
