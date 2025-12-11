import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';

export const navTheme = {
    dark: false,
    colors: {
        primary: colors.primary.DEFAULT,
        background: colors.background,
        card: colors.white,
        text: colors.foreground,
        border: colors.border,
        notification: colors.destructive.DEFAULT,
    },
    fonts: {
        regular: {
            fontFamily: 'System',
            fontWeight: '400',
        },
        medium: {
            fontFamily: 'System',
            fontWeight: '500',
        },
        bold: {
            fontFamily: 'System',
            fontWeight: '700',
        },
        heavy: {
            fontFamily: 'System',
            fontWeight: '900',
        },
    },
};

export const theme = {
    colors,
    spacing,
    radius,
    typography,
};
