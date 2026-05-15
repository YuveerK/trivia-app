/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        charleston: '#222831',
        'american-orange': '#FF8A08',
        gold: '#F59E0B',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        stage: '0 0 0 1px hsl(var(--border)), 0 20px 40px -10px hsl(0 0% 0% / 0.15)',
        'stage-lg': '0 0 0 1px hsl(var(--border)), 0 32px 64px -16px hsl(0 0% 0% / 0.28)',
        glow: '0 0 24px -5px hsl(var(--primary) / 0.65), 0 12px 40px -10px hsl(var(--primary) / 0.4)',
        'glow-sm': '0 0 14px -4px hsl(var(--primary) / 0.55)',
        'glow-lg': '0 0 48px -8px hsl(var(--primary) / 0.75), 0 24px 64px -16px hsl(var(--primary) / 0.45)',
        gold: '0 0 22px -5px rgba(245, 158, 11, 0.7)',
        glass: '0 8px 32px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
        'inner-shine': 'inset 0 1px 0 0 rgba(255,255,255,0.12)',
        'answer-a': '0 8px 32px -8px rgba(124,58,237,0.65)',
        'answer-b': '0 8px 32px -8px rgba(37,99,235,0.65)',
        'answer-c': '0 8px 32px -8px rgba(217,119,6,0.65)',
        'answer-d': '0 8px 32px -8px rgba(5,150,105,0.65)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeOut: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.4)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
          '75%': { transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        scorePop: {
          '0%': { transform: 'scale(1)' },
          '45%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', opacity: '1' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        timerUrgent: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        orb: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-25px) scale(1.06)' },
          '66%': { transform: 'translate(-18px,22px) scale(0.96)' },
        },
        tada: {
          '0%': { transform: 'scale(1)' },
          '10%, 20%': { transform: 'scale(0.9) rotate(-3deg)' },
          '30%, 50%, 70%, 90%': { transform: 'scale(1.1) rotate(3deg)' },
          '40%, 60%, 80%': { transform: 'scale(1.1) rotate(-3deg)' },
          '100%': { transform: 'scale(1) rotate(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        riseUp: {
          '0%': { opacity: '0', transform: 'translateY(40px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.4s ease-out both',
        fadeOut: 'fadeOut 0.3s ease-out both',
        slideUp: 'slideUp 0.4s ease-out both',
        slideDown: 'slideDown 0.4s ease-out both',
        scaleIn: 'scaleIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both',
        bounceIn: 'bounceIn 0.6s cubic-bezier(0.215,0.610,0.355,1.000) both',
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 7s ease-in-out infinite',
        'float-slow': 'float 11s ease-in-out infinite',
        scorePop: 'scorePop 0.5s ease-out',
        pulseRing: 'pulseRing 1.5s ease-out infinite',
        timerUrgent: 'timerUrgent 0.6s ease-in-out infinite',
        orb: 'orb 9s ease-in-out infinite',
        'orb-delay': 'orb 13s ease-in-out 3s infinite',
        tada: 'tada 0.9s ease-in-out',
        slideInRight: 'slideInRight 0.4s ease-out both',
        riseUp: 'riseUp 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
