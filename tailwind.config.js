/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'neon-purple': '#b000f5',
                'neon-blue': '#00d4ff',
                'deep-space': '#0f0e13',
                'glass-white': 'rgba(255, 255, 255, 0.05)',
            },
            fontFamily: {
                'hack': ['"Space Mono"', 'monospace'], // Suggestion, though we stick to Inter for now
                'sans': ['Inter', 'sans-serif'],
            },
            animation: {
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                }
            }
        },
    },
    plugins: [],
}
