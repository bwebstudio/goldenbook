/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Editorial luxury palette (from design mockups)
        primary: '#D2B68A',       // Champagne Gold — main accent
        navy: {
          DEFAULT: '#222D52',
          light: '#2E3D6B',
          dark: '#161E38',
        },
        ivory: {
          DEFAULT: '#FDFDFB',
          soft: '#F9F7F2',
        },
        // Legacy palette (kept for backward compat)
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        ink: {
          DEFAULT: '#0A0A0A',
          soft: '#1A1A1A',
          muted: '#2A2A2A',
        },
        cream: {
          DEFAULT: '#F8F5F0',
          soft: '#FAF8F4',
        },
      },
      fontFamily: {
        serif: ['PlayfairDisplay_400Regular'],
        'serif-italic': ['PlayfairDisplay_400Regular_Italic'],
        'serif-bold': ['PlayfairDisplay_700Bold'],
        sans: ['Inter_400Regular'],
        'sans-light': ['Inter_300Light'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
};
