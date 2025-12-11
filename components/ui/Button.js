import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import { theme } from '../../theme';
import { Text } from './Text';

export function Button({
    children,
    variant = 'default',
    size = 'default',
    onPress,
    loading = false,
    disabled = false,
    style,
    textStyle,
    icon,
    ...props
}) {
    const getBackgroundColor = () => {
        if (disabled) return theme.colors.muted.DEFAULT;
        switch (variant) {
            case 'default': return theme.colors.primary.DEFAULT;
            case 'destructive': return theme.colors.destructive.DEFAULT;
            case 'secondary': return theme.colors.gray[200]; // Secondary usually lighter gray
            case 'outline': return 'transparent';
            case 'ghost': return 'transparent';
            case 'link': return 'transparent';
            default: return theme.colors.primary.DEFAULT;
        }
    };

    const getTextColor = () => {
        if (disabled) return theme.colors.muted.foreground;
        switch (variant) {
            case 'default': return theme.colors.primary.foreground;
            case 'destructive': return theme.colors.destructive.foreground;
            case 'secondary': return theme.colors.gray[900];
            case 'outline': return theme.colors.gray[900];
            case 'ghost': return theme.colors.gray[900];
            case 'link': return theme.colors.primary.DEFAULT;
            default: return theme.colors.primary.foreground;
        }
    };

    const getBorder = () => {
        if (variant === 'outline') {
            return {
                borderWidth: 1,
                borderColor: theme.colors.border,
            };
        }
        return {};
    };

    const getHeight = () => {
        switch (size) {
            case 'sm': return 32;
            case 'lg': return 48;
            case 'icon': return 40;
            default: return 40;
        }
    };

    const getPadding = () => {
        switch (size) {
            case 'sm': return { paddingHorizontal: theme.spacing[3] };
            case 'lg': return { paddingHorizontal: theme.spacing[8] };
            case 'icon': return { width: 40, paddingHorizontal: 0 };
            default: return { paddingHorizontal: theme.spacing[4] };
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.base,
                {
                    backgroundColor: getBackgroundColor(),
                    height: getHeight(),
                    ...getPadding(),
                    ...getBorder(),
                },
                disabled && styles.disabled,
                style,
            ]}
            {...props}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon && <View style={styles.iconContainer}>{icon}</View>}
                    <Text
                        style={[
                            styles.text,
                            { color: getTextColor() },
                            (size === 'sm' && { fontSize: theme.typography.sizes.xs }),
                            (variant === 'link' && { textDecorationLine: 'underline' }),
                            textStyle
                        ]}
                        weight="medium"
                    >
                        {children}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: theme.spacing[2],
    },
    disabled: {
        opacity: 0.5,
    },
});
