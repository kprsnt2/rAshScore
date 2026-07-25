import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
                // Design system tokens
                rs: {
                    base: 'var(--rs-bg-base)',
                    surface: 'var(--rs-bg-surface)',
                    elevated: 'var(--rs-bg-elevated)',
                    hover: 'var(--rs-bg-hover)',
                },
            },
            borderColor: {
                rs: {
                    DEFAULT: 'var(--rs-border)',
                    hover: 'var(--rs-border-hover)',
                    active: 'var(--rs-border-active)',
                },
            },
            textColor: {
                rs: {
                    primary: 'var(--rs-text-primary)',
                    secondary: 'var(--rs-text-secondary)',
                    muted: 'var(--rs-text-muted)',
                    faint: 'var(--rs-text-faint)',
                },
            },
            borderRadius: {
                rs: 'var(--rs-radius-md)',
                'rs-sm': 'var(--rs-radius-sm)',
                'rs-lg': 'var(--rs-radius-lg)',
                'rs-xl': 'var(--rs-radius-xl)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'gradient': 'gradient-shift 8s ease infinite',
                'float': 'float 3s ease-in-out infinite',
                'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
            },
            keyframes: {
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-6px)' },
                },
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
};
export default config;
