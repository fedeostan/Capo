import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, KeyboardAvoidingView, Image, TouchableOpacity, Alert, Modal, DeviceEventEmitter, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../utils/formatDate';

const PREDEFINED_ICONS = ['list', 'layout', 'trello', 'calendar', 'check-square', 'clipboard', 'layers', 'grid'];

export default function ProjectCreateModal({ navigation }) {
    const [projectName, setProjectName] = useState('');
    const [icon, setIcon] = useState('list');
    const [image, setImage] = useState(null);
    const [durationWeeks, setDurationWeeks] = useState('4');

    // Default dates
    const today = new Date();
    const [startDate, setStartDate] = useState(today);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || startDate;
        // On iOS, we keep the modal open until "Done" is pressed (or handle inline change)
        setStartDate(currentDate);
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: Platform.OS === 'ios', // Disable editing on Android to avoid UI issues
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Sorry, we need camera permissions to make this work!');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: Platform.OS === 'ios',
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const getDeadline = () => {
        const start = new Date(startDate);
        const weeks = parseInt(durationWeeks) || 0;
        const end = new Date(start);
        end.setDate(start.getDate() + (weeks * 7));
        return end.toISOString().split('T')[0];
    };

    const handleCreate = () => {
        if (!projectName.trim()) {
            Alert.alert("Missing Name", "Please enter a project name.");
            return;
        }
        if (!image) {
            Alert.alert("Missing Quote", "Please upload a photo of your quote.");
            return;
        }
        if (!durationWeeks || isNaN(durationWeeks)) {
            Alert.alert("Invalid Duration", "Please enter a valid number of weeks.");
            return;
        }

        // Strategy: Dismiss modal and pass data to Dashboard to trigger the full-screen overlay.

        // 1. Dismiss modal immediately (user perceives it closing)
        // 2. Pass params to the screen "underneath" (Dashboard)

        // Strategy: Dismiss modal and pass data to Dashboard via Event Emitter to trigger the full-screen overlay.

        // 1. Emit event with project data
        DeviceEventEmitter.emit('create-project-processing', {
            projectName,
            quoteUri: image,
            startDate: startDate.toISOString().split('T')[0],
            deadline: getDeadline(),
            durationWeeks,
            icon // Pass the selected icon
        });

        // 2. Dismiss modal immediately
        navigation.goBack();
    };

    return (
        <View style={styles.overlayContainer}>
            <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
                <View style={styles.backdrop} />
            </TouchableWithoutFeedback>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.keyboardView}
                pointerEvents="box-none"
            >
                <View style={styles.sheetContainer}>
                    <View style={styles.header}>
                        <Text variant="h3">New Project</Text>
                        <Button variant="ghost" onPress={() => navigation.goBack()} size="sm">
                            <Feather name="x" size={24} color={theme.colors.gray[500]} />
                        </Button>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>

                        {/* Project Name */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Project Name</Text>
                            <Input
                                placeholder="e.g. Kitchen Renovation"
                                value={projectName}
                                onChangeText={setProjectName}
                            />
                        </View>

                        {/* Icon Selection */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Project Icon</Text>
                            <View style={styles.iconGrid}>
                                {PREDEFINED_ICONS.map((item) => (
                                    <TouchableOpacity
                                        key={item}
                                        style={[
                                            styles.iconOption,
                                            icon === item && styles.iconOptionSelected
                                        ]}
                                        onPress={() => setIcon(item)}
                                    >
                                        <Feather
                                            name={item}
                                            size={24}
                                            color={icon === item ? theme.colors.primary.DEFAULT : theme.colors.gray[500]}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Quote Upload */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Upload Quote</Text>
                            {image ? (
                                <View style={styles.previewContainer}>
                                    <Image source={{ uri: image }} style={styles.preview} />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onPress={() => setImage(null)}
                                        style={styles.clearButton}
                                    >
                                        Change
                                    </Button>
                                </View>
                            ) : (
                                <View style={styles.uploadButtons}>
                                    <Button variant="outline" onPress={pickImage} style={styles.halfButton}>
                                        <Feather name="image" size={18} style={{ marginRight: 8 }} />
                                        Gallery
                                    </Button>
                                    <Button variant="outline" onPress={takePhoto} style={styles.halfButton}>
                                        <Feather name="camera" size={18} style={{ marginRight: 8 }} />
                                        Camera
                                    </Button>
                                </View>
                            )}
                        </View>

                        {/* Start Date */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Start Date</Text>
                            <TouchableOpacity
                                style={styles.dateInput}
                                onPress={() => setShowDatePicker(!showDatePicker)}
                            >
                                <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                                <Feather name="calendar" size={20} color={theme.colors.gray[500]} />
                            </TouchableOpacity>

                            {showDatePicker && Platform.OS === 'ios' && (
                                <View style={styles.inlinePickerContainer}>
                                    <DateTimePicker
                                        testID="dateTimePicker"
                                        value={startDate}
                                        mode={'date'}
                                        display="inline"
                                        onChange={onDateChange}
                                        style={styles.iosPicker}
                                        themeVariant="light"
                                        accentColor={theme.colors.primary.DEFAULT}
                                        textColor={theme.colors.foreground}
                                    />
                                </View>
                            )}

                            {showDatePicker && Platform.OS === 'android' && (
                                <DateTimePicker
                                    testID="dateTimePicker"
                                    value={startDate}
                                    mode={'date'}
                                    is24Hour={true}
                                    display="default"
                                    onChange={onDateChange}
                                />
                            )}
                        </View>

                        {/* Timeline */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Duration</Text>
                            <View style={styles.durationContainer}>
                                {['2', '4', '8', '12'].map((weeks) => (
                                    <TouchableOpacity
                                        key={weeks}
                                        style={[styles.durationButton, durationWeeks === weeks && styles.durationSelected]}
                                        onPress={() => setDurationWeeks(weeks)}
                                    >
                                        <Text style={[styles.durationText, durationWeeks === weeks && styles.durationTextSelected]}>
                                            {weeks}w
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text variant="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                Estimated deadline: {getDeadline()}
                            </Text>
                        </View>

                        <Button onPress={handleCreate} size="lg" style={{ marginTop: theme.spacing[4], marginBottom: theme.spacing[8] }}>
                            Create Project
                        </Button>

                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Dimmed background
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    keyboardView: {
        justifyContent: 'flex-end',
        flex: 1,
    },
    sheetContainer: {
        backgroundColor: theme.colors.gray[50], // Match app bg
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        maxHeight: '90%', // Don't take full screen
        overflow: 'hidden',
        paddingTop: theme.spacing[4],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[6],
        paddingBottom: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray[200],
    },
    content: {
        padding: theme.spacing[6],
    },
    section: {
        marginBottom: theme.spacing[6],
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.gray[700],
        marginBottom: theme.spacing[2],
    },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.gray[300],
        borderRadius: theme.radius.md,
        padding: theme.spacing[3],
        backgroundColor: 'white',
        fontSize: 16,
    },
    uploadButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    halfButton: {
        flex: 1,
    },
    previewContainer: {
        position: 'relative',
        height: 200,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.gray[300],
    },
    preview: {
        width: '100%',
        height: '100%',
    },
    clearButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    durationContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    durationButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.gray[300],
        alignItems: 'center',
        backgroundColor: 'white',
    },
    durationSelected: {
        borderColor: theme.colors.primary.DEFAULT,
        backgroundColor: theme.colors.primary.light,
    },
    durationText: {
        fontWeight: '500',
        color: theme.colors.gray[700],
    },
    durationTextSelected: {
        color: theme.colors.primary.DEFAULT,
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: theme.colors.gray[300],
        borderRadius: theme.radius.md,
        padding: theme.spacing[3],
        backgroundColor: 'white',
    },
    dateText: {
        fontSize: 16,
        color: theme.colors.gray[900],
    },
    inlinePickerContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    iosPicker: {
        height: 320,
        width: 320, // Constrain width for better centering
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    iconOption: {
        width: 48,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.gray[200],
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.white,
    },
    iconOptionSelected: {
        borderColor: theme.colors.primary.DEFAULT,
        backgroundColor: theme.colors.primary.light,
    }
});
