import React, { useState } from 'react';
import { TextInput, View, StyleSheet } from 'react-native';
import { theme } from '../../theme';
import { Text } from './Text';

export function Input({
    label,
    error,
    style,
    containerStyle,
    placeholderTextColor = theme.colors.muted.foreground,
    ...props
}) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <Text variant="small" weight="medium" style={styles.label}>
                    {label}
                </Text>
            )}
            <TextInput
                style={[
                    styles.input,
                    isFocused && styles.focused,
                    error && styles.error,
                    style,
                ]}
                placeholderTextColor={placeholderTextColor}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                {...props}
            />
            {error && (
                <Text variant="small" style={styles.errorText}>
                    {error}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing[4],
    },
    label: {
        marginBottom: theme.spacing[2],
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderColor: theme.colors.input,
        borderRadius: theme.radius.md,
        backgroundColor: 'transparent',
        paddingHorizontal: theme.spacing[3],
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.foreground,
    },
    focused: {
        borderColor: theme.colors.ring,
        // Add box shadow simulation if needed
    },
    error: {
        borderColor: theme.colors.destructive.DEFAULT,
    },
    errorText: {
        color: theme.colors.destructive.DEFAULT,
        marginTop: theme.spacing[1],
    },
});
