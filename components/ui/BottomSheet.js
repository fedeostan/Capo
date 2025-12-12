import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Animated, TouchableWithoutFeedback, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { theme } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheet = ({ visible, onClose, children, style }) => {
    const [showModal, setShowModal] = useState(visible);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShowModal(false);
            });
        }
    }, [visible]);

    if (!showModal) return null;

    return (
        <Modal
            transparent
            visible={showModal}
            onRequestClose={onClose}
            animationType="none" // We handle animation ourselves
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View
                        style={[
                            styles.backdrop,
                            { opacity: fadeAnim }
                        ]}
                    />
                </TouchableWithoutFeedback>

                {/* Sheet Content */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                    pointerEvents="box-none"
                >
                    <Animated.View
                        style={[
                            styles.sheet,
                            { transform: [{ translateY: slideAnim }] },
                            style
                        ]}
                    >
                        {children}
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: theme.colors.white,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        padding: theme.spacing[6],
        paddingBottom: theme.spacing[10],
        maxHeight: '92%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
});
