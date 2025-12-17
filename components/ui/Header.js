import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Text } from './Text';

export function Header({
    title,
    subtitle,
    showBack = false,
    backText = 'Back',
    onBack,
    rightAction,
    children,
    style
}) {
    const navigation = useNavigation();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigation.goBack();
        }
    };

    return (
        <View style={[styles.container, style]}>
            <View style={styles.topRow}>
                <View style={styles.leftContainer}>
                    {showBack && (
                        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                            <Feather name="chevron-left" size={24} color={theme.colors.foreground} />
                            <Text style={styles.backText}>{backText}</Text>
                        </TouchableOpacity>
                    )}
                    {title && !children && (
                        <View style={styles.titleContainer}>
                            <Text variant="h2">{title}</Text>
                            {subtitle && <Text variant="muted">{subtitle}</Text>}
                        </View>
                    )}
                </View>
                {rightAction && <View style={styles.rightContainer}>{rightAction}</View>}
            </View>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: theme.colors.background,
        paddingHorizontal: theme.spacing[6],
        paddingBottom: theme.spacing[4],
        paddingTop: Platform.OS === 'android' ? theme.spacing[8] : theme.spacing[6],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray[200],
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 44,
        marginBottom: theme.spacing[4], // Add spacing between nav and children
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: theme.spacing[4],
    },
    backText: {
        fontSize: 16,
        color: theme.colors.foreground,
        marginLeft: -4,
    },
    titleContainer: {
        flex: 1,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
