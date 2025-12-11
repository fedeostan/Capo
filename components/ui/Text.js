import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { theme } from '../../theme';

export function Text({
    children,
    variant = 'p',
    color,
    align = 'left',
    weight,
    style,
    ...props
}) {
    const textStyle = {
        ...styles[variant],
        color: color || styles[variant].color || theme.colors.foreground,
        textAlign: align,
        ...(weight && { fontWeight: theme.typography.weights[weight] }),
    };

    return (
        <RNText style={[textStyle, style]} {...props}>
            {children}
        </RNText>
    );
}

const styles = StyleSheet.create({
    h1: {
        fontSize: theme.typography.sizes['4xl'],
        lineHeight: theme.typography.lineHeights['4xl'],
        fontWeight: theme.typography.weights.extrabold,
        color: theme.colors.foreground,
        letterSpacing: -1,
    },
    h2: {
        fontSize: theme.typography.sizes['3xl'],
        lineHeight: theme.typography.lineHeights['3xl'],
        fontWeight: theme.typography.weights.bold,
        color: theme.colors.foreground,
        letterSpacing: -0.5,
    },
    h3: {
        fontSize: theme.typography.sizes['2xl'],
        lineHeight: theme.typography.lineHeights['2xl'],
        fontWeight: theme.typography.weights.bold,
        color: theme.colors.foreground,
        letterSpacing: -0.5,
    },
    h4: {
        fontSize: theme.typography.sizes.xl,
        lineHeight: theme.typography.lineHeights.xl,
        fontWeight: theme.typography.weights.bold,
        color: theme.colors.foreground,
    },
    p: {
        fontSize: theme.typography.sizes.base,
        lineHeight: theme.typography.lineHeights.base,
        fontWeight: theme.typography.weights.regular,
        color: theme.colors.foreground,
    },
    lead: {
        fontSize: theme.typography.sizes.lg,
        lineHeight: theme.typography.lineHeights.lg,
        fontWeight: theme.typography.weights.regular,
        color: theme.colors.muted.foreground,
    },
    large: {
        fontSize: theme.typography.sizes.lg,
        lineHeight: theme.typography.lineHeights.lg,
        fontWeight: theme.typography.weights.medium,
        color: theme.colors.foreground,
    },
    small: {
        fontSize: theme.typography.sizes.sm,
        lineHeight: theme.typography.lineHeights.sm,
        fontWeight: theme.typography.weights.medium,
        color: theme.colors.foreground,
    },
    muted: {
        fontSize: theme.typography.sizes.sm,
        lineHeight: theme.typography.lineHeights.sm,
        fontWeight: theme.typography.weights.regular,
        color: theme.colors.muted.foreground,
    },
});
