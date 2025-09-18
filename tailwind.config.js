/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/renderer/**/*.{ts,tsx,html}",
        "./index.html"
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    hover: "hsl(var(--primary-hover))",
                    light: "hsl(var(--primary-light))",
                    border: "hsl(var(--primary-border))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                    hover: "hsl(var(--secondary-hover))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                    light: "hsl(var(--destructive-light))",
                },
                success: {
                    DEFAULT: "hsl(var(--success))",
                    foreground: "hsl(var(--success-foreground))",
                    light: "hsl(var(--success-light))",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning))",
                    foreground: "hsl(var(--warning-foreground))",
                    light: "hsl(var(--warning-light))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                    hover: "hsl(var(--accent-hover))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                sidebar: {
                    DEFAULT: "hsl(var(--sidebar-background))",
                    border: "hsl(var(--sidebar-border))",
                    hover: "hsl(var(--sidebar-hover))",
                    active: "hsl(var(--sidebar-active))",
                },
            },
            boxShadow: {
                'xs': 'var(--shadow-xs)',
                'sm': 'var(--shadow-sm)',
                'DEFAULT': 'var(--shadow)',
                'md': 'var(--shadow-md)',
                'lg': 'var(--shadow-lg)',
                'xl': 'var(--shadow-xl)',
            },
            backgroundImage: {
                'gradient-primary': 'var(--gradient-primary)',
                'gradient-surface': 'var(--gradient-surface)',
            },
            fontFamily: {
                sans: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Inter"', 'system-ui', 'sans-serif'],
                mono: ['"SF Mono"', '"Fira Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
            },
            fontSize: {
                'heading-1': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.025em', fontWeight: '700' }],
                'heading-2': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.02em', fontWeight: '600' }],
                'heading-3': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.015em', fontWeight: '600' }],
                'heading-4': ['1.25rem', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
                'body-lg': ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
                'body': ['1rem', { lineHeight: '1.5', letterSpacing: '-0.005em' }],
                'body-sm': ['0.875rem', { lineHeight: '1.45', letterSpacing: '0' }],
                'label': ['0.875rem', { lineHeight: '1.4', letterSpacing: '-0.005em', fontWeight: '500' }],
                'caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
            },
            letterSpacing: {
                tightest: '-0.025em',
                tighter: '-0.02em',
                tight: '-0.015em',
                normal: '-0.005em',
                wide: '0.01em',
            },
            fontWeight: {
                light: '300',
                normal: '400',
                medium: '450',
                semibold: '500',
                bold: '600',
                extrabold: '700',
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: 0 },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: 0 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
        require('@tailwindcss/container-queries'),
    ],
}


