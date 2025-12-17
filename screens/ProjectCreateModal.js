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
    const [durationValue, setDurationValue] = useState('4');
    const [durationUnit, setDurationUnit] = useState('weeks'); // 'days' | 'weeks'

    // Default dates
    // Default dates
    const today = new Date();
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date(today);
        d.setDate(d.getDate() + 28); // Default 4 weeks
        return d;
    });

    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const onStartDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowStartDatePicker(false);
        }
        if (selectedDate) {
            setStartDate(selectedDate);
            // Ensure end date is not before start date
            if (endDate < selectedDate) {
                const newEnd = new Date(selectedDate);
                newEnd.setDate(newEnd.getDate() + 7);
                setEndDate(newEnd);
            }
        }
    };

    const onEndDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowEndDatePicker(false);
        }
        if (selectedDate) {
            setEndDate(selectedDate);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: Platform.OS === 'ios', // Disable editing on Android to avoid UI issues
            aspect: [3, 4],
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
            aspect: [3, 4],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const getDurationString = () => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return "Invalid duration";

        if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        } else {
            const weeks = Math.round((diffDays / 7) * 2) / 2;
            return `${weeks} week${weeks !== 1 ? 's' : ''}`;
        }
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
        // Calculate duration in weeks for backward compatibility / API
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weeks = diffDays / 7;

        // Strategy: Dismiss modal and pass data to Dashboard via Event Emitter to trigger the full-screen overlay.

        // 1. Emit event with project data
        DeviceEventEmitter.emit('create-project-processing', {
            projectName,
            quoteUri: image,
            startDate: startDate.toISOString().split('T')[0],
            deadline: endDate.toISOString().split('T')[0],
            durationWeeks: weeks.toString(),
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
                behavior={Platform.OS === "ios" ? "padding" : "height"}
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

                    <ScrollView
                        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >

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
                                        <Feather name="image" size={18} style={{ marginRight: 12 }} />
                                        Gallery
                                    </Button>
                                    <Button variant="outline" onPress={takePhoto} style={styles.halfButton}>
                                        <Feather name="camera" size={18} style={{ marginRight: 12 }} />
                                        Camera
                                    </Button>
                                </View>
                            )}
                        </View>

                        {/* Timeline: Start & End Date */}
                        <View style={styles.section}>
                            <Text style={styles.label}>Timeline</Text>
                            <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                                {/* Start Date */}
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { fontSize: theme.typography.sizes.xs, marginBottom: theme.spacing[1] }]}>Start</Text>
                                    {Platform.OS === 'ios' ? (
                                        <DateTimePicker
                                            value={startDate}
                                            mode={'date'}
                                            display="compact"
                                            onChange={onStartDateChange}
                                            themeVariant="light"
                                            accentColor={theme.colors.primary.DEFAULT}
                                            textColor={theme.colors.foreground}
                                            style={{ alignSelf: 'flex-start' }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.dateInput}
                                            onPress={() => setShowStartDatePicker(true)}
                                        >
                                            <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* End Date */}
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { fontSize: theme.typography.sizes.xs, marginBottom: theme.spacing[1] }]}>End</Text>
                                    {Platform.OS === 'ios' ? (
                                        <DateTimePicker
                                            value={endDate}
                                            mode={'date'}
                                            display="compact"
                                            onChange={onEndDateChange}
                                            themeVariant="light"
                                            accentColor={theme.colors.primary.DEFAULT}
                                            textColor={theme.colors.foreground}
                                            minimumDate={startDate}
                                            style={{ alignSelf: 'flex-start' }}
                                        />
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.dateInput}
                                            onPress={() => setShowEndDatePicker(true)}
                                        >
                                            <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Android Date Modals */}
                            {Platform.OS === 'android' && showStartDatePicker && (
                                <DateTimePicker
                                    value={startDate}
                                    mode={'date'}
                                    display="default"
                                    onChange={onStartDateChange}
                                />
                            )}
                            {Platform.OS === 'android' && showEndDatePicker && (
                                <DateTimePicker
                                    value={endDate}
                                    mode={'date'}
                                    display="default"
                                    onChange={onEndDateChange}
                                    minimumDate={startDate}
                                />
                            )}

                            {/* Auto Calculation Display */}
                            <View style={styles.deadlineCard}>
                                <View style={styles.deadlineHeader}>
                                    <Feather name="clock" size={16} color={theme.colors.gray[500]} />
                                    <Text style={styles.deadlineLabel}>Estimated Duration</Text>
                                </View>
                                <Text style={styles.deadlineDate}>{getDurationString()}</Text>
                            </View>
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
        backgroundColor: theme.colors.overlay, // Dimmed background
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
        fontSize: theme.typography.sizes.sm,
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
        fontSize: theme.typography.sizes.base,
    },
    uploadButtons: {
        flexDirection: 'row',
        gap: theme.spacing[3],
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
    durationInputContainer: {
        flexDirection: 'row',
        gap: theme.spacing[3],
    },
    durationInput: {
        flex: 1,
        textAlign: 'center',
    },
    unitToggle: {
        flex: 2,
        flexDirection: 'row',
        backgroundColor: theme.colors.gray[200],
        padding: 4,
        borderRadius: theme.radius.md,
        height: 50, // Match input height roughly
    },
    unitButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: theme.radius.sm,
    },
    unitSelected: {
        backgroundColor: 'white',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    unitText: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: '500',
        color: theme.colors.gray[500],
    },
    unitTextSelected: {
        color: theme.colors.gray[900],
        fontWeight: '600',
    },
    deadlineCard: {
        marginTop: theme.spacing[4],
        backgroundColor: theme.colors.gray[100],
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        // Removed borderLeftWidth/Color for subtler look
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    deadlineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deadlineLabel: {
        fontSize: theme.typography.sizes.sm, // Slightly larger normal text props
        fontWeight: '500',
        color: theme.colors.gray[600],
        // Removed uppercase/letterspacing
    },
    deadlineDate: {
        fontSize: theme.typography.sizes.base,
        fontWeight: '600',
        color: theme.colors.gray[900],
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
        fontSize: theme.typography.sizes.base,
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
        gap: theme.spacing[3],
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
