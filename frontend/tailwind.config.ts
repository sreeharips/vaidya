import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream:      '#F7F3ED',
        cream2:     '#EDE7DC',
        gold:       '#B8862C',
        'gold-lt':  '#F5E9D0',
        forest:     '#1E3D2F',
        forest2:    '#2D5440',
        'forest-lt':'#E4EDE8',
        bark:       '#6B4F3A',
        'bark-lt':  '#F0E8E0',
        slate:      '#3D3530',
        muted:      '#8A7F76',
      },
      fontFamily: {
        /* Match next/font variables from app/layout.tsx */
        serif: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans:  ['var(--font-dm-sans)', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '32px',
      },
      boxShadow: {
        card:  '0 2px 24px rgba(30,61,47,0.08)',
        card2: '0 8px 48px rgba(30,61,47,0.12)',
      },
      transitionTimingFunction: {
        vaidya: 'cubic-bezier(0.4,0,0.2,1)',
      },
      transitionDuration: {
        vaidya: '220ms',
      },
    },
  },
  plugins: [],
}
export default config
