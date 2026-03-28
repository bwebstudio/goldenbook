import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palette — exact match to goldenbook-mobile tokens.ts
        primary: '#D2B68A',
        navy: {
          DEFAULT: '#222D52',
          light: '#2E3D6B',
          dark: '#161E38',
        },
        ivory: {
          DEFAULT: '#FDFDFB',
          soft: '#F9F7F2',
        },
        ink: {
          DEFAULT: '#161E38',  // navy-dark — no pure black anywhere
          soft: '#1B2545',
          muted: '#222D52',   // navy DEFAULT
        },
        cream: {
          DEFAULT: '#F8F5F0',
          soft: '#FAF8F4',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Mobile token scale (base)
        // No letter-spacing baked in — apply per-element in globals.css or inline
        display: ['32px', { lineHeight: '1.1' }],
        title: ['24px', { lineHeight: '1.2' }],
        subtitle: ['20px', { lineHeight: '1.3' }],
        body: ['16px', { lineHeight: '1.6' }],
        small: ['14px', { lineHeight: '1.5' }],
        caption: ['12px', { lineHeight: '1.4' }],
        label: ['10px', { lineHeight: '1.4', letterSpacing: '0.1em' }],
      },
      spacing: {
        // 4pt grid from tokens
        'screen': '24px',
        'section': '80px',
        'section-lg': '120px',
      },
      letterSpacing: {
        widest: '0.3em',
        wider: '0.15em',
        wide: '0.08em',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(to top, #161E38 0%, rgba(22,30,56,0.85) 40%, rgba(22,30,56,0.3) 100%)',
        'navy-gradient': 'linear-gradient(135deg, #161E38 0%, #222D52 100%)',
        'gold-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(210,182,138,0.15) 50%, transparent 100%)',
      },
      animation: {
        'shimmer': 'shimmer 2.5s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
