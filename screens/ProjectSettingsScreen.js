import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card } from '../components/ui/Card';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '../utils/formatDate';

const PREDEFINED_ICONS = ['list', 'layout', 'trello', 'calendar', 'check-square', 'clipboard', 'layers', 'grid'];

export default function ProjectSettingsScreen({ route, navigation }) {
    const { projectId } = route.params;
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [initialData, setInitialData] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [unsavedModalVisible, setUnsavedModalVisible] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('list');
    const [startDate, setStartDate] = useState(new Date());
    const [deadline, setDeadline] = useState(new Date());

    // Date Picker State
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Track changes
    useEffect(() => {
        if (!initialData) return;

        const isChanged =
            name !== initialData.name ||
            icon !== initialData.icon ||
            startDate.getTime() !== initialData.startDate.getTime() ||
            deadline.getTime() !== initialData.deadline.getTime();

        setHasChanges(isChanged);
    }, [name, icon, startDate, deadline, initialData]);

    // Intercept Back Navigation
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (!hasChanges) {
                // If we don't have changes, let it go back
                return;
            }

            // Prevent default behavior of leaving the screen
            e.preventDefault();

            // Prompt the user
            setUnsavedModalVisible(true);
        });

        return unsubscribe;
    }, [navigation, hasChanges]);


    useEffect(() => {
        loadProject();
    }, [projectId]);

    const loadProject = async () => {
        try {
            const docRef = doc(db, "projects", projectId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const loadedName = data.name || '';
                const loadedIcon = data.icon || 'list';
                let loadedStart = new Date();
                let loadedDeadline = new Date();

                if (data.startDate) {
                    loadedStart = new Date(data.startDate);
                }

                if (data.deadline) {
                    loadedDeadline = new Date(data.deadline);
                } else if (data.startDate && data.durationWeeks) {
                    const start = new Date(data.startDate);
                    const end = new Date(start);
                    end.setDate(start.getDate() + (parseInt(data.durationWeeks) * 7));
                    loadedDeadline = end;
                }

                setName(loadedName);
                setIcon(loadedIcon);
                setStartDate(loadedStart);
                setDeadline(loadedDeadline);

                setInitialData({
                    name: loadedName,
                    icon: loadedIcon,
                    startDate: loadedStart,
                    deadline: loadedDeadline
                });
            } else {
                Alert.alert("Error", "Project not found");
                navigation.goBack();
            }
        } catch (error) {
            console.error("Error loading project:", error);
            Alert.alert("Error", "Failed to load project details");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Project name cannot be empty");
            return;
        }

        setIsSaving(true);
        try {
            const updates = {
                name: name.trim(),
                icon,
                startDate: startDate.toISOString().split('T')[0],
                deadline: deadline.toISOString().split('T')[0],
                durationWeeks: Math.ceil((deadline - startDate) / (1000 * 60 * 60 * 24 * 7)).toString()
            };

            const docRef = doc(db, "projects", projectId);
            await updateDoc(docRef, updates);

            // Update initial data so we don't trigger unsaved changes warning if we stay (though we nav back below)
            setInitialData({
                name: name.trim(),
                icon,
                startDate: startDate,
                deadline: deadline
            });
            setHasChanges(false);

            Alert.alert("Success", "Project settings updated", [
                { text: "OK", onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error("Error saving project:", error);
            Alert.alert("Error", "Failed to save changes");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        setUnsavedModalVisible(false);
        setHasChanges(false); // Disable check momentarily or just force go back
        // We can just go back. We need to bypass the listener.
        // Easiest is to set hasChanges false, then go back.
        // But state update might be async.
        // Actually, we can dispatch the action if we saved it, but simpler:
        navigation.dispatch(navigation.goBack());
    };

    // Correction: handleDiscard needs to work despite the listener.
    // If we call navigation.goBack(), the listener fires again.
    // We need to bypass it.
    // Common pattern: set a ref `isDiscarding`? Or simpler: just use navigation.removeListener inside handleDiscard? No.
    // React Navigation `beforeRemove` event.data.action is what we want to dispatch? 
    // But here we might just want to 'pop'.

    // Improved Discard Logic:
    const confirmDiscard = () => {
        // We want to force navigation back.
        // We can temporarily remove listener or assume that setting state + effect will handle it, but that's racy.
        // The standard way is using the `action` from the event, but we didn't save it.
        // Let's just set hasChanges(false) and THEN navigate? No, effect dependency.

        // Simpler: Just rely on navigation.dispatch AND the fact we can update state.
        // BUT, better approach for `beforeRemove`:
        // We need the action that was prevented. OR just manually go back.
        // If I manually go back, the listener triggers again.
        // So I must set hasChanges(false) first.

        setHasChanges(false);
        setTimeout(() => {
            navigation.goBack();
        }, 0);
    };


    const onStartDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || startDate;
        setShowStartPicker(Platform.OS === 'ios');
        setStartDate(currentDate);
        if (Platform.OS !== 'ios') setShowStartPicker(false);
    };

    const onDeadlineChange = (event, selectedDate) => {
        const currentDate = selectedDate || deadline;
        setShowEndPicker(Platform.OS === 'ios');
        setDeadline(currentDate);
        if (Platform.OS !== 'ios') setShowEndPicker(false);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Feather name="loader" size={24} color={theme.colors.primary.DEFAULT} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.white }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonRow}>
                    <Feather name="chevron-left" size={24} color={theme.colors.foreground} />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Project Settings</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={{ flex: 1, backgroundColor: theme.colors.gray[50] }}>
                <ScrollView contentContainerStyle={styles.content}>

                    {/* Icon Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Project Icon</Text>
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
                                        color={icon === item ? theme.colors.primary.DEFAULT : theme.colors.gray[400]}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Details Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Details</Text>

                        <Text style={styles.label}>Project Name</Text>
                        <Input
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter project name"
                            style={{ marginBottom: theme.spacing[4] }}
                        />

                        {/* Start Date */}
                        <Text style={styles.label}>Start Date</Text>
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => setShowStartPicker(!showStartPicker)}
                        >
                            <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                            <Feather name="calendar" size={20} color={theme.colors.gray[500]} />
                        </TouchableOpacity>

                        {showStartPicker && (
                            <DateTimePicker
                                testID="startDatePicker"
                                value={startDate}
                                mode={'date'}
                                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                onChange={onStartDateChange}
                                style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                                accentColor={theme.colors.primary.DEFAULT}
                            />
                        )}

                        {/* Deadline */}
                        <Text style={[styles.label, { marginTop: theme.spacing[4] }]}>Deadline</Text>
                        <TouchableOpacity
                            style={styles.dateInput}
                            onPress={() => setShowEndPicker(!showEndPicker)}
                        >
                            <Text style={styles.dateText}>{formatDate(deadline)}</Text>
                            <Feather name="flag" size={20} color={theme.colors.gray[500]} />
                        </TouchableOpacity>

                        {showEndPicker && (
                            <DateTimePicker
                                testID="deadlinePicker"
                                value={deadline}
                                mode={'date'}
                                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                onChange={onDeadlineChange}
                                style={Platform.OS === 'ios' ? styles.iosPicker : undefined}
                                accentColor={theme.colors.primary.DEFAULT}
                                minimumDate={startDate}
                            />
                        )}

                        <View style={styles.warningContainer}>
                            <Feather name="info" size={16} color={theme.colors.primary.DEFAULT} style={{ marginTop: 2 }} />
                            <Text style={styles.warningText}>
                                Changing dates will cause the AI to reschedule all tasks currently in the backlog.
                            </Text>
                        </View>
                    </View>

                </ScrollView>
            </View>

            {/* Footer Actions - Only visible if has changes */}
            {hasChanges && (
                <View style={styles.footer}>
                    <Button variant="outline" onPress={() => {
                        // Revert to initial
                        if (initialData) {
                            setName(initialData.name);
                            setIcon(initialData.icon);
                            setStartDate(initialData.startDate);
                            setDeadline(initialData.deadline);
                        }
                    }} style={{ flex: 1, marginRight: 8 }}>
                        Cancel
                    </Button>
                    <Button onPress={handleSave} isLoading={isSaving} style={{ flex: 1, marginLeft: 8 }}>
                        Save Changes
                    </Button>
                </View>
            )}

            {/* Unsaved Changes Modal */}
            <View>
                {/* Hack: The React Native Modal component might not work well deeply nested if not absolute or portal.
                     Using transparent Full Screen Absolute View as custom modal for simplicity and design control.
                  */}
                {unsavedModalVisible && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text variant="h4" style={{ marginBottom: 8, textAlign: 'center' }}>Unsaved Changes</Text>
                            <Text style={{ marginBottom: 24, textAlign: 'center', color: theme.colors.muted.foreground }}>
                                Are you sure you want to leave without saving your changes?
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <Button
                                    variant="outline"
                                    onPress={() => setUnsavedModalVisible(false)} // Cancel/Stay
                                    style={{ flex: 1 }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onPress={() => {
                                        setUnsavedModalVisible(false);
                                        // Save logic
                                        handleSave();
                                    }}
                                    style={{ flex: 1 }}
                                >
                                    Save Changes
                                </Button>
                            </View>
                            <TouchableOpacity
                                onPress={confirmDiscard}
                                style={{ marginTop: 16, alignItems: 'center' }}
                            >
                                <Text style={{ color: theme.colors.destructive.DEFAULT }}>Discard Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.white, // Safe area color
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[4],
        backgroundColor: theme.colors.white,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray[200],
    },
    backButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 60, // Fixed width for balance
    },
    backButtonText: {
        fontSize: 16,
        color: theme.colors.foreground,
        marginLeft: theme.spacing[1],
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.foreground,
        textAlign: 'center',
    },
    content: {
        padding: theme.spacing[6],
    },
    section: {
        marginBottom: theme.spacing[8],
        backgroundColor: theme.colors.white,
        padding: theme.spacing[4],
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.gray[200],
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: theme.spacing[4],
        color: theme.colors.foreground,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
    },
    iconOption: {
        width: 56,
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.gray[200],
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.gray[50],
    },
    iconOptionSelected: {
        borderColor: theme.colors.primary.DEFAULT,
        backgroundColor: theme.colors.primary.light,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: theme.spacing[2],
        color: theme.colors.gray[700],
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
    iosPicker: {
        height: 320,
        width: '100%',
        marginTop: 10,
    },
    footer: {
        padding: theme.spacing[4],
        backgroundColor: theme.colors.white,
        borderTopWidth: 1,
        borderTopColor: theme.colors.gray[200],
        flexDirection: 'row',
    },
    warningContainer: {
        flexDirection: 'row',
        backgroundColor: theme.colors.primary.light,
        padding: theme.spacing[3],
        borderRadius: theme.radius.md,
        marginTop: theme.spacing[6],
    },
    warningText: {
        fontSize: 12,
        color: theme.colors.primary.dark,
        marginLeft: theme.spacing[2],
        flex: 1,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    modalContent: {
        width: '85%',
        maxWidth: 320,
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    }
});
