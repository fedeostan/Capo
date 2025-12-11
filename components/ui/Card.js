import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Text } from './Text';

export function Card({ children, style, ...props }) {
    return (
        <View style={[styles.card, style]} {...props}>
            {children}
        </View>
    );
}

export function CardHeader({ children, style, ...props }) {
    return (
        <View style={[styles.header, style]} {...props}>
            {children}
        </View>
    );
}

export function CardTitle({ children, style, ...props }) {
    return (
        <Text variant="h4" style={[styles.title, style]} {...props}>
            {children}
        </Text>
    );
}

export function CardDescription({ children, style, ...props }) {
    return (
        <Text variant="muted" style={[styles.description, style]} {...props}>
            {children}
        </Text>
    );
}

export function CardContent({ children, style, ...props }) {
    return (
        <View style={[styles.content, style]} {...props}>
            {children}
        </View>
    );
}

export function CardFooter({ children, style, ...props }) {
    return (
        <View style={[styles.footer, style]} {...props}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2, // Android shadow
    },
    header: {
        padding: theme.spacing[6],
        paddingBottom: theme.spacing[3],
    },
    title: {
        marginBottom: theme.spacing[1],
    },
    description: {
        // defaults ok
    },
    content: {
        padding: theme.spacing[6],
        paddingTop: 0,
    },
    footer: {
        padding: theme.spacing[6],
        paddingTop: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
});
