export const colors = {
    white: '#FFFFFF',
    black: '#27272a', // Zinc-800 - significantly lighter than pure black

    // Grays (Slate/Zinc inspired)
    gray: {
        50: '#fafafa',
        100: '#f4f4f5',
        200: '#e4e4e7',
        300: '#d4d4d8',
        400: '#a1a1aa',
        500: '#71717a',
        600: '#52525b',
        700: '#3f3f46',
        800: '#27272a',
        900: '#27272a', // Capped at 800 for minimal look
        950: '#27272a', // Capped at 800
    },
    emerald: {
        600: '#059669',
    },

    // Primary Accent (Violet)
    primary: {
        DEFAULT: '#7c3aed', // Violet-600
        foreground: '#FFFFFF',
        hover: '#6d28d9', // Violet-700
        light: '#ddd6fe', // Violet-200
    },

    // Semantic
    background: '#FFFFFF',
    foreground: '#27272a',

    muted: {
        DEFAULT: '#f4f4f5', // Gray-100
        foreground: '#71717a', // Gray-500
    },

    destructive: {
        DEFAULT: '#ef4444', // Red-500
        foreground: '#FFFFFF',
    },

    border: '#e4e4e7', // Gray-200
    input: '#e4e4e7', // Gray-200
    ring: '#7c3aed', // Violet-600 (Primary)
};
