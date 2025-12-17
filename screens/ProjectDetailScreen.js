import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Dimensions, FlatList, TextInput, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { formatDate } from '../utils/formatDate';
import { Feather } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import DateTimePicker from '@react-native-community/datetimepicker';

import { BottomSheet } from '../components/ui/BottomSheet';
import { Header } from '../components/ui/Header';
import { AILogViewer } from '../components/AILogViewer';

const COLUMN_WIDTH = 300;

const PREDEFINED_ICONS = ['list', 'layout', 'trello', 'calendar', 'check-square', 'clipboard', 'layers', 'grid'];

const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Strip all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Check formatting
    if (cleaned.length === 10) {
        return "+ 1" + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return "+" + cleaned;
    } else {
        // Fallback: prepend + if not present (best effort for international)
        return "+" + cleaned;
    }
};

export default function ProjectDetailScreen({ route, navigation }) {
    const { projectId, projectName } = route.params;
    const [tasks, setTasks] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);

    // Header specific state
    const [projectNameState, setProjectNameState] = useState(projectName);
    const [projectIcon, setProjectIcon] = useState('list');
    const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [aiLogVisible, setAiLogVisible] = useState(false);

    // New Task State
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');
    const [newTaskStartDate, setNewTaskStartDate] = useState('');
    const [newTaskDuration, setNewTaskDuration] = useState('');
    const [newTaskDependencies, setNewTaskDependencies] = useState([]);
    const [dependencyModalVisible, setDependencyModalVisible] = useState(false);
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    const [newTaskPhone, setNewTaskPhone] = useState('');
    const [conflictWarning, setConflictWarning] = useState(null);
    const [showNewTaskStartDatePicker, setShowNewTaskStartDatePicker] = useState(false);
    const [showNewTaskEndDatePicker, setShowNewTaskEndDatePicker] = useState(false);
    const [calculatedDurationString, setCalculatedDurationString] = useState('');

    // Detail / View State
    const [viewMode, setViewMode] = useState('board');
    const [collapsedSections, setCollapsedSections] = useState({});
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [moveMenuTask, setMoveMenuTask] = useState(null);

    // Date Picker State for Task Details
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showDueDatePicker, setShowDueDatePicker] = useState(false);

    const onStartDateChange = async (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowStartDatePicker(false);
        }

        if (selectedDate && selectedTask) {
            // Validation: Start Date cannot be after Due Date (if Due Date is set)
            if (selectedTask.dueDate) {
                const due = new Date(selectedTask.dueDate);
                if (selectedDate > due) {
                    Alert.alert("Invalid Date", "Start date cannot be after due date.");
                    return;
                }
            }

            // Update local state and Firestore
            const isoDate = selectedDate.toISOString().split('T')[0];
            const updated = { ...selectedTask, startDate: isoDate };
            setSelectedTask(updated);

            try {
                await setDoc(doc(db, "tasks", selectedTask.id), { startDate: isoDate }, { merge: true });
            } catch (e) {
                console.error("Error updating start date", e);
                Alert.alert("Error", "Failed to update start date");
            }
        }
    };

    const onDueDateChange = async (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowDueDatePicker(false);
        }

        if (selectedDate && selectedTask) {
            // Validation: Due Date cannot be before Start Date
            if (selectedTask.startDate) {
                const start = new Date(selectedTask.startDate);
                if (selectedDate < start) {
                    Alert.alert("Invalid Date", "Due date cannot be before start date.");
                    return;
                }
            }

            // Update local state and Firestore
            const isoDate = selectedDate.toISOString().split('T')[0];
            const updated = { ...selectedTask, dueDate: isoDate };
            setSelectedTask(updated);

            try {
                await setDoc(doc(db, "tasks", selectedTask.id), { dueDate: isoDate }, { merge: true });
            } catch (e) {
                console.error("Error updating due date", e);
                Alert.alert("Error", "Failed to update due date");
            }
        }
    };

    const updateDuration = (start, end) => {
        if (!start || !end) {
            setNewTaskDuration('');
            setCalculatedDurationString('');
            return;
        }
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = endDate - startDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            setNewTaskDuration('');
            setCalculatedDurationString('Invalid dates');
            return;
        }

        setNewTaskDuration(diffDays.toString());

        if (diffDays < 7) {
            setCalculatedDurationString(`${diffDays} day${diffDays !== 1 ? 's' : ''}`);
        } else {
            // Count weeks, allow increments of 0.5
            // e.g., 7 days = 1 week. 10 days = 1.4 ish. -> 1.5 weeks?
            // User request: "Or weeks and a half".
            // Logic: divide by 7, multiply by 2, round, divide by 2.
            const weeks = Math.round((diffDays / 7) * 2) / 2;
            setCalculatedDurationString(`${weeks} week${weeks !== 1 ? 's' : ''}`);
        }
    };

    const onNewTaskStartDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowNewTaskStartDatePicker(false);
        }
        if (selectedDate) {
            const isoDate = selectedDate.toISOString().split('T')[0];
            setNewTaskStartDate(isoDate);
            updateDuration(isoDate, newTaskDueDate);
            const conflict = checkConflicts(newTaskPhone, isoDate, newTaskDuration);
            // Note: conflict check uses the OLD duration logic here unless we recalc, 
            // but since duration state updates async, we might be slightly off in this specific render cycle.
            // Better to recalc conflict with the new derived duration if needed, but for now this is fine.
        }
    };

    const onNewTaskEndDateChange = (event, selectedDate) => {
        if (Platform.OS === 'android') {
            setShowNewTaskEndDatePicker(false);
        }
        if (selectedDate) {
            const isoDate = selectedDate.toISOString().split('T')[0];
            setNewTaskDueDate(isoDate);
            updateDuration(newTaskStartDate, isoDate);
        }
    };

    // DEBUG: Monitor tasks for isNew
    // DEBUG: Monitor tasks for isNew
    useEffect(() => {
        const newTasks = tasks.filter(t => t.isNew);
        console.log('[ProjectDetail] Found ' + newTasks.length + ' new tasks:', newTasks.map(function (t) { return t.id; }));
    }, [tasks]);

    useEffect(() => {
        const q = query(collection(db, "tasks"), where("projectId", "==", projectId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const taskData = [];
            snapshot.forEach((doc) => {
                taskData.push({ id: doc.id, ...doc.data() });
            });
            setTasks(taskData);
        });

        return () => unsubscribe();
        return () => unsubscribe();
    }, [projectId]);

    // Listen to Project Details (Name, Icon)
    useEffect(() => {
        const unsubscribeProject = onSnapshot(doc(db, "projects", projectId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.name) navigation.setParams({ projectName: data.name }); // Update param if needed, or just use state
                // Since we render from params or local state, let's use local state for header info to be reactive
                setProjectNameState(data.name || projectName);
                setProjectIcon(data.icon || 'list');
            }
        });
        return () => unsubscribeProject();
    }, [projectId]);

    const handleDeleteProject = async () => {
        try {
            console.log("Deleting project", projectId);
            await deleteDoc(doc(db, "projects", projectId));

            setDeleteModalVisible(false);
            navigation.goBack();
        } catch (error) {
            console.error("Error deleting project:", error);
            alert("Failed to delete project: " + error.message);
        }
    };

    const checkConflicts = (phone, startDate, duration) => {
        if (!phone || !startDate || !duration) return null;

        const start = new Date(startDate);
        const days = parseInt(duration) || 0;
        const end = new Date(start);
        end.setDate(end.getDate() + days);

        const conflictingTask = tasks.find(t => {
            if (t.assigneePhone !== phone || t.status === 'done') return false;
            // Assuming tasks have startDate and duration now. If not, we skip.
            if (!t.startDate || !t.duration) return false;

            const tStart = new Date(t.startDate);
            const tEnd = new Date(tStart);
            tEnd.setDate(tEnd.getDate() + (parseInt(t.duration) || 0));

            // Check overlap
            return (start < tEnd && end > tStart);
        });

        return conflictingTask;
    };

    const checkDependencyConflicts = (startDate, dependencyIds) => {
        if (!startDate || dependencyIds.length === 0) return null;
        const start = new Date(startDate);

        for (const depId of dependencyIds) {
            const depTask = tasks.find(t => t.id === depId);
            if (depTask && depTask.startDate && depTask.duration) {
                const depEnd = new Date(depTask.startDate);
                depEnd.setDate(depEnd.getDate() + (parseInt(depTask.duration) || 0));

                if (start < depEnd) {
                    return depTask;
                }
            }
        }
        return null;
    };

    const handlePickContact = async (isNew = true) => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const contact = await Contacts.presentContactPickerAsync();
                if (contact) {
                    const assigneeFirstName = contact.firstName || '';
                    const assigneeLastName = contact.lastName || '';
                    const assigneeName = contact.name || (assigneeFirstName + " " + assigneeLastName).trim();
                    let assigneePhone = '';

                    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                        assigneePhone = contact.phoneNumbers[0].number;
                    }

                    if (isNew) {

                        const formattedPhone = formatPhoneNumber(assigneePhone);
                        setNewTaskAssignee(assigneeName);
                        setNewTaskPhone(formattedPhone);

                        // Check conflicts immediately if we have dates
                        const conflict = checkConflicts(formattedPhone, newTaskStartDate, newTaskDuration);
                        setConflictWarning(conflict ? `Conflict with task "${conflict.title}"` : null);
                    } else if (selectedTask) {
                        // Update existing task
                        const formattedPhone = formatPhoneNumber(assigneePhone);
                        const updated = { ...selectedTask, assignee: assigneeName, assigneePhone: formattedPhone };
                        setSelectedTask(updated);
                        try {
                            await setDoc(doc(db, "tasks", selectedTask.id), {
                                assignee: assigneeName,
                                assigneePhone: formattedPhone
                            }, { merge: true });
                        } catch (e) {
                            console.error("Error updating assignee", e);
                            alert("Failed to update assignee");
                        }
                    }
                }
            } else {
                alert('Permission to access contacts was denied');
            }
        } catch (e) {
            console.log(e);
        }
    };

    const handleCreateTask = async () => {
        if (!newTaskTitle) return;

        // Final conflict check
        const conflict = checkConflicts(newTaskPhone, newTaskStartDate, newTaskDuration);
        const depConflict = checkDependencyConflicts(newTaskStartDate, newTaskDependencies);

        if (conflict) {
            // As mentioned, just visual warning is often enough, but let's log or alert if needed.
        }

        try {
            await addDoc(collection(db, 'tasks'), {
                title: newTaskTitle,
                description: newTaskDescription,
                dueDate: newTaskDueDate,
                startDate: newTaskStartDate,
                duration: newTaskDuration,
                dependencies: newTaskDependencies,
                assignee: newTaskAssignee,
                assigneePhone: formatPhoneNumber(newTaskPhone),
                status: 'backlog',
                projectId: projectId,
                isNew: true,
                createdAt: new Date()
            });
            setModalVisible(false);
            setNewTaskTitle('');
            setNewTaskDescription('');
            setNewTaskDueDate('');
            setNewTaskStartDate('');
            setNewTaskDuration('');
            setNewTaskDependencies([]);
            setNewTaskAssignee('');
            setNewTaskPhone('');
            setConflictWarning(null);
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    const toggleSection = (section) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const moveTask = async (task, newStatus) => {
        if (task.status !== newStatus) {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
            try {
                await setDoc(doc(db, "tasks", task.id), { status: newStatus }, { merge: true });
            } catch (e) {
                console.error("Move failed", e);
            }
        }
        setMoveMenuTask(null);
    };

    const renderTaskCard = (task) => (
        <View key={task.id}>
            <TouchableOpacity
                onPress={async () => {
                    setSelectedTask(task);
                    if (task.isNew) {
                        try {
                            await setDoc(doc(db, "tasks", task.id), { isNew: false }, { merge: true });
                        } catch (e) {
                            console.error("Error updating isNew status", e);
                        }
                    }
                }}
                onLongPress={() => setMoveMenuTask(task)}
                activeOpacity={0.9}
            >
                <Card style={styles.taskCard}>
                    <CardHeader style={{ padding: theme.spacing[3], paddingBottom: 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                {task.isNew && (
                                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.sky[400], marginRight: 8, flexShrink: 0 }} />
                                )}
                                <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{task.title}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setMoveMenuTask(task)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Feather name="move" size={14} color={theme.colors.muted.foreground} />
                            </TouchableOpacity>
                        </View>
                    </CardHeader>
                    <CardContent style={{ padding: theme.spacing[3] }}>
                        <Text variant="muted" style={{ marginBottom: theme.spacing[1] }} numberOfLines={2}>{task.description}</Text>
                        <Text variant="small" style={{ fontStyle: 'italic', color: theme.colors.primary.DEFAULT }}>
                            {task.assignee ? `Assigned to: ${task.assignee} ` : 'Unassigned'}
                        </Text>
                        {task.dueDate && (
                            <Text variant="small" style={{ color: theme.colors.muted.foreground, marginTop: 4 }}>
                                Due: {formatDate(task.dueDate)}
                            </Text>
                        )}
                    </CardContent>
                </Card>
            </TouchableOpacity>
        </View>
    );

    const renderListRow = (task) => (
        <View key={task.id}>
            <TouchableOpacity
                onPress={async () => {
                    setSelectedTask(task);
                    if (task.isNew) {
                        try {
                            await setDoc(doc(db, "tasks", task.id), { isNew: false }, { merge: true });
                        } catch (e) {
                            console.error("Error updating isNew status", e);
                        }
                    }
                }}
                onLongPress={() => setMoveMenuTask(task)}
                activeOpacity={0.9}
            >
                <Card style={styles.listCard}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            {task.isNew && (
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#38bdf8', marginRight: 8, flexShrink: 0 }} />
                            )}
                            <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{task.title}</Text>
                        </View>
                        <Text variant="muted" style={{ fontSize: 13, marginTop: 4 }} numberOfLines={1}>{task.description}</Text>
                        {task.dueDate && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing[2] }}>
                                <Feather name="calendar" size={12} color={theme.colors.muted.foreground} style={{ marginRight: 4 }} />
                                <Text variant="small" style={{ fontSize: 11, color: theme.colors.muted.foreground }}>
                                    {formatDate(task.dueDate)}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.miniBadge}>
                            <Text variant="small" style={{ fontSize: theme.typography.sizes.xxs, color: theme.colors.primary.DEFAULT }}>
                                {task.assignee || 'Unassigned'}
                            </Text>
                        </View>
                        <TouchableOpacity style={{ marginLeft: theme.spacing[3] }} onPress={() => setMoveMenuTask(task)}>
                            <Feather name="move" size={16} color={theme.colors.muted.foreground} />
                        </TouchableOpacity>
                    </View>
                </Card>
            </TouchableOpacity>
        </View>
    );

    const renderListSection = (title, data, sectionKey) => {
        const isCollapsed = collapsedSections[sectionKey];
        return (
            <View key={sectionKey} style={styles.listSection}>
                <TouchableOpacity onPress={() => toggleSection(sectionKey)} style={styles.listSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name={isCollapsed ? "chevron-right" : "chevron-down"} size={18} color={theme.colors.foreground} style={{ marginRight: theme.spacing[2] }} />
                        <Text variant="h4" style={{ fontSize: 18 }}>{title}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: theme.colors.gray[400] }]}>
                        <Text variant="small" style={{ color: theme.colors.white }}>{data.length}</Text>
                    </View>
                </TouchableOpacity>
                {!isCollapsed && (
                    <View>
                        {data.map(renderListRow)}
                        {data.length === 0 && (
                            <View style={{ padding: theme.spacing[4], alignItems: 'center' }}>
                                <Text variant="small" style={{ fontStyle: 'italic', color: theme.colors.muted.foreground }}>No tasks</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderColumn = (title, columnTasks, statusId, badgeColor = theme.colors.gray[400]) => (
        <View style={styles.column}>
            <View style={styles.columnHeader}>
                <Text variant="large" weight="bold">{title}</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor }]}><Text variant="small" style={{ color: theme.colors.white }}>{columnTasks.length}</Text></View>
            </View>
            <View>
                {columnTasks.map(renderTaskCard)}
                <View style={{ height: 20 }} />
            </View>
        </View>
    );

    const backlogTasks = tasks.filter(t => t.status === 'backlog');
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const doneTasks = tasks.filter(t => t.status === 'done');

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.colors.white, paddingTop: Platform.OS === 'android' ? 16 : 0 }}>
            <View style={[styles.container, { marginBottom: Platform.OS === 'android' ? 16 : 0 }]}>
                <Header
                    style={{ paddingTop: Platform.OS === 'ios' ? 0 : undefined }}
                    showBack={true}
                    backText="Home"
                    onBack={() => navigation.goBack()}
                    rightAction={
                        <View style={styles.headerRightActions}>

                            {/* Options Menu */}
                            <TouchableOpacity
                                style={styles.roundButton}
                                onPress={() => setHeaderMenuVisible(true)}
                            >
                                <Feather name="more-horizontal" size={20} color={theme.colors.foreground} />
                            </TouchableOpacity>
                        </View>
                    }

                >
                    {/* Row 2: Project Info */}
                    < View style={styles.newHeaderProjectRow} >
                        <View style={styles.projectIconContainer}>
                            <Feather name={projectIcon} size={24} color={theme.colors.primary.DEFAULT} />
                        </View>

                        <Text variant="h2" style={styles.projectTitleText}>{projectNameState}</Text>
                    </View >

                    {/* Row 3: View Toggles (Restored) */}
                    < View style={styles.viewToggleRow} >
                        <View style={styles.viewToggleContainer}>
                            <TouchableOpacity
                                style={[styles.viewToggleBtn, viewMode === 'board' && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode('board')}
                            >
                                <Feather name="columns" size={14} color={viewMode === 'board' ? theme.colors.primary.DEFAULT : theme.colors.muted.foreground} />
                                <Text style={[styles.viewToggleText, viewMode === 'board' && styles.viewToggleTextActive]}>Board</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                                onPress={() => setViewMode('list')}
                            >
                                <Feather name="list" size={14} color={viewMode === 'list' ? theme.colors.primary.DEFAULT : theme.colors.muted.foreground} />
                                <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>List</Text>
                            </TouchableOpacity>
                        </View>
                    </View >

                    {/* Header Menu Modal */}
                    < Modal
                        animationType="fade"
                        transparent={true}
                        visible={headerMenuVisible}
                        onRequestClose={() => setHeaderMenuVisible(false)
                        }
                    >
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            activeOpacity={1}
                            onPress={() => setHeaderMenuVisible(false)}
                        >
                            <View style={styles.headerMenuDropdown}>
                                <TouchableOpacity
                                    style={styles.headerMenuItem}
                                    onPress={() => {
                                        setHeaderMenuVisible(false);
                                        navigation.navigate('ProjectSettings', { projectId });
                                    }}
                                >
                                    <Feather name="settings" size={16} color={theme.colors.foreground} style={{ marginRight: 8 }} />
                                    <Text>Project Settings</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.headerMenuItem}
                                    onPress={() => {
                                        setHeaderMenuVisible(false);
                                        setAiLogVisible(true);
                                    }}
                                >
                                    <Feather name="terminal" size={16} color={theme.colors.foreground} style={{ marginRight: 8 }} />
                                    <Text>View AI Logs</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.headerMenuItem}
                                    onPress={() => {
                                        setHeaderMenuVisible(false);
                                        setDeleteModalVisible(true);
                                    }}
                                >
                                    <Feather name="trash-2" size={16} color={theme.colors.destructive.DEFAULT} style={{ marginRight: 8 }} />
                                    <Text style={{ color: theme.colors.destructive.DEFAULT }}>Delete project</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Modal >

                    {/* Delete Confirmation Modal */}
                    < Modal
                        animationType="fade"
                        transparent={true}
                        visible={deleteModalVisible}
                        onRequestClose={() => setDeleteModalVisible(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <Card style={styles.deleteConfirmCard}>
                                <CardHeader>
                                    <CardTitle style={{ color: theme.colors.destructive.DEFAULT }}>Delete Project?</CardTitle>
                                    <CardDescription>This action cannot be undone. Are you sure you want to delete "{projectName}"?</CardDescription>
                                </CardHeader>
                                <View style={styles.modalButtons}>
                                    <Button
                                        variant="outline"
                                        onPress={() => setDeleteModalVisible(false)}
                                        style={{ flex: 1, marginRight: 8 }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onPress={handleDeleteProject}
                                        style={{ flex: 1, marginLeft: 8, backgroundColor: theme.colors.destructive.DEFAULT }}
                                    >
                                        Delete
                                    </Button>
                                </View>
                            </Card>
                        </View>
                    </Modal >

                    {/* AI Log Viewer Modal */}
                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={aiLogVisible}
                        onRequestClose={() => setAiLogVisible(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                            <View style={{ height: '80%', width: '100%' }}>
                                <AILogViewer projectId={projectId} onClose={() => setAiLogVisible(false)} />
                            </View>
                        </View>
                    </Modal>
                </Header>

                {viewMode === 'board' ? (
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
                        <ScrollView
                            style={styles.board}
                            horizontal={true}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.boardContent}
                        >
                            {renderColumn('Backlog', backlogTasks, 'backlog', theme.colors.gray[400])}
                            {renderColumn('In Progress', inProgressTasks, 'in-progress', theme.colors.gray[400])}
                            {renderColumn('Done', doneTasks, 'done', theme.colors.gray[400])}
                        </ScrollView>
                    </ScrollView>
                ) : (
                    <ScrollView style={styles.listContainer} contentContainerStyle={{ padding: theme.spacing[4], paddingBottom: theme.spacing[24] }}>
                        {renderListSection("Backlog", backlogTasks, 'backlog')}
                        {renderListSection("In Progress", inProgressTasks, 'in-progress')}
                        {renderListSection("Done", doneTasks, 'done')}
                    </ScrollView>
                )}

                {/* FABs */}
                <View style={styles.fabContainer}>
                    {menuVisible && (
                        <Card style={styles.menuContainer}>
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    setMenuVisible(false);
                                    navigation.navigate('UploadQuote', { projectId });
                                }}
                            >
                                <Feather name="upload" size={16} color={theme.colors.foreground} style={{ marginRight: theme.spacing[2] }} />
                                <Text>Upload Quote</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                                <Feather name="settings" size={16} color={theme.colors.foreground} style={{ marginRight: theme.spacing[2] }} />
                                <Text>Item 1</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setMenuVisible(false)}>
                                <Feather name="info" size={16} color={theme.colors.foreground} style={{ marginRight: theme.spacing[2] }} />
                                <Text>Item 2</Text>
                            </TouchableOpacity>
                        </Card>
                    )}

                    <Button
                        onPress={() => setModalVisible(true)}
                        size="lg"
                        style={styles.fab}
                    >
                        + Task
                    </Button>

                    <TouchableOpacity
                        style={styles.secondaryFab}
                        onPress={() => setMenuVisible(!menuVisible)}
                        activeOpacity={0.8}
                    >
                        <Feather name="more-horizontal" size={24} color={theme.colors.foreground} />
                    </TouchableOpacity>
                </View>

                <BottomSheet
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    style={{ height: '92%' }}
                >
                    <View style={{ flex: 1 }}>
                        <View style={styles.asanaHeader}>
                            <TouchableOpacity
                                style={[
                                    styles.completeButton,
                                    { borderColor: theme.colors.primary.DEFAULT, backgroundColor: theme.colors.primary.DEFAULT }
                                ]}
                                onPress={handleCreateTask}
                            >
                                <Feather name="plus" size={16} color={theme.colors.white} style={{ marginRight: theme.spacing[2] }} />
                                <Text weight="medium" style={{ color: theme.colors.white, fontSize: 13 }}>
                                    Create Task
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.headerIcons}>
                                <TouchableOpacity style={styles.iconButton} onPress={() => setModalVisible(false)}>
                                    <Feather name="x" size={20} color={theme.colors.foreground} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                            <TextInput
                                style={styles.asanaTitleInput}
                                value={newTaskTitle}
                                multiline
                                placeholder="New Task Title"
                                placeholderTextColor={theme.colors.gray[400]}
                                onChangeText={setNewTaskTitle}
                            />

                            <View style={styles.metaContainer}>
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Assignee</Text>
                                    <TouchableOpacity
                                        style={styles.metaValueContainer}
                                        onPress={() => handlePickContact(true)}
                                    >
                                        <View style={styles.assigneeAvatar}>
                                            <Text style={{ color: theme.colors.white, fontSize: 10, fontWeight: 'bold' }}>
                                                {(newTaskAssignee || 'U').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.metaValueText}>{newTaskAssignee || 'Unassigned'}</Text>
                                        <Feather name="chevron-down" size={14} color={theme.colors.muted.foreground} style={{ marginLeft: 6 }} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Start date</Text>
                                    {Platform.OS === 'ios' ? (
                                        <DateTimePicker
                                            value={newTaskStartDate ? new Date(newTaskStartDate) : new Date()}
                                            mode={'date'}
                                            display="compact"
                                            onChange={onNewTaskStartDateChange}
                                            accentColor={theme.colors.primary.DEFAULT}
                                            themeVariant="light"
                                            style={{ alignSelf: 'flex-start' }}
                                        />
                                    ) : (
                                        <>
                                            <TouchableOpacity
                                                style={styles.metaValueContainer}
                                                onPress={() => setShowNewTaskStartDatePicker(true)}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Feather name="calendar" size={18} color={theme.colors.muted.foreground} />
                                                    <Text style={[styles.metaValueText, { marginLeft: theme.spacing[3] }]}>
                                                        {newTaskStartDate ? formatDate(newTaskStartDate) : 'Set date'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                            {showNewTaskStartDatePicker && (
                                                <DateTimePicker
                                                    value={newTaskStartDate ? new Date(newTaskStartDate) : new Date()}
                                                    mode={'date'}
                                                    display="default"
                                                    onChange={onNewTaskStartDateChange}
                                                    accentColor={theme.colors.primary.DEFAULT}
                                                />
                                            )}
                                        </>
                                    )}
                                </View>

                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>End date</Text>
                                    {Platform.OS === 'ios' ? (
                                        <DateTimePicker
                                            value={newTaskDueDate ? new Date(newTaskDueDate) : new Date()}
                                            mode={'date'}
                                            display="compact"
                                            onChange={onNewTaskEndDateChange}
                                            accentColor={theme.colors.primary.DEFAULT}
                                            themeVariant="light"
                                            minimumDate={newTaskStartDate ? new Date(newTaskStartDate) : undefined}
                                            style={{ alignSelf: 'flex-start' }}
                                        />
                                    ) : (
                                        <>
                                            <TouchableOpacity
                                                style={styles.metaValueContainer}
                                                onPress={() => setShowNewTaskEndDatePicker(true)}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Feather name="calendar" size={18} color={theme.colors.muted.foreground} />
                                                    <Text style={[styles.metaValueText, { marginLeft: theme.spacing[3] }]}>
                                                        {newTaskDueDate ? formatDate(newTaskDueDate) : 'Set date'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                            {showNewTaskEndDatePicker && (
                                                <DateTimePicker
                                                    value={newTaskDueDate ? new Date(newTaskDueDate) : new Date()}
                                                    mode={'date'}
                                                    display="default"
                                                    onChange={onNewTaskEndDateChange}
                                                    accentColor={theme.colors.primary.DEFAULT}
                                                    minimumDate={newTaskStartDate ? new Date(newTaskStartDate) : undefined}
                                                />
                                            )}
                                        </>
                                    )}
                                </View>

                                {calculatedDurationString ? (
                                    <View style={[styles.metaRow, { marginTop: -8 }]}>
                                        <Text style={styles.metaLabel}>Duration</Text>
                                        <View style={styles.metaValueContainer}>
                                            <Text style={[styles.metaValueText, { color: theme.colors.muted.foreground, fontStyle: 'italic' }]}>
                                                {calculatedDurationString}
                                            </Text>
                                        </View>
                                    </View>
                                ) : null}

                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Applies to</Text>
                                    <View style={styles.metaValueContainer}>
                                        <View style={styles.projectBadge}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary.DEFAULT }}>{projectName}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Dependencies</Text>
                                    <TouchableOpacity
                                        style={styles.metaValueContainer}
                                        onPress={() => setDependencyModalVisible(true)}
                                    >
                                        <Feather name="link" size={16} color={theme.colors.muted.foreground} style={{ marginRight: 8 }} />
                                        <Text style={styles.metaValueText}>
                                            {newTaskDependencies.length > 0 ? `${newTaskDependencies.length} tasks` : 'Add dependencies'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.descriptionContainer}>
                                <Text weight="medium" style={{ marginBottom: theme.spacing[2], fontSize: 14 }}>Description</Text>
                                <TextInput
                                    style={styles.descriptionInput}
                                    value={newTaskDescription}
                                    multiline
                                    placeholder="What is this task about?"
                                    placeholderTextColor={theme.colors.muted.foreground}
                                    onChangeText={setNewTaskDescription}
                                />
                            </View>

                            {checkDependencyConflicts(newTaskStartDate, newTaskDependencies) && (
                                <View style={{ backgroundColor: '#fff7ed', padding: 8, borderRadius: 4, marginBottom: 16 }}>
                                    <Text style={{ color: '#c2410c', fontWeight: 'bold' }}>
                                        ⚠️ Starts before dependency "{checkDependencyConflicts(newTaskStartDate, newTaskDependencies).title}" ends.
                                    </Text>
                                </View>
                            )}

                            {conflictWarning && (
                                <View style={{ backgroundColor: '#fee2e2', padding: 8, borderRadius: 4, marginBottom: 16 }}>
                                    <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ {conflictWarning}</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </BottomSheet>



                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={dependencyModalVisible}
                    onRequestClose={() => setDependencyModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <Card style={[styles.modalView, { maxHeight: '80%' }]}>
                            <CardHeader>
                                <CardTitle>Select Dependencies</CardTitle>
                                <CardDescription>Select tasks that must be finished before this one starts.</CardDescription>
                            </CardHeader>
                            <ScrollView style={{ maxHeight: 300, padding: 16 }}>
                                {tasks.filter(t => t.status !== 'done').map(task => (
                                    <TouchableOpacity
                                        key={task.id}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.gray[100] }}
                                        onPress={() => {
                                            if (newTaskDependencies.includes(task.id)) {
                                                setNewTaskDependencies(prev => prev.filter(id => id !== task.id));
                                            } else {
                                                setNewTaskDependencies(prev => [...prev, task.id]);
                                            }
                                        }}
                                    >
                                        <Feather
                                            name={newTaskDependencies.includes(task.id) ? "check-square" : "square"}
                                            size={20}
                                            color={newTaskDependencies.includes(task.id) ? theme.colors.primary.DEFAULT : theme.colors.gray[400]}
                                            style={{ marginRight: 12 }}
                                        />
                                        <Text>{task.title}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={{ padding: 16 }}>
                                <Button onPress={() => setDependencyModalVisible(false)}>Done</Button>
                            </View>
                        </Card>
                    </View>
                </Modal>

                {/* Task Detail Bottom Sheet */}
                <BottomSheet
                    visible={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                    style={{ height: '92%' }}
                >
                    {selectedTask && (
                        <View style={{ flex: 1 }}>
                            {/* Action Header */}
                            <View style={styles.asanaHeader}>
                                <TouchableOpacity
                                    style={[
                                        styles.completeButton,
                                        selectedTask.status === 'done' && styles.completeButtonActive
                                    ]}
                                    onPress={async () => {
                                        const newStatus = selectedTask.status === 'done' ? 'in-progress' : 'done';
                                        // Optimistic Update
                                        const updated = { ...selectedTask, status: newStatus };
                                        setSelectedTask(updated);
                                        try {
                                            await setDoc(doc(db, "tasks", selectedTask.id), { status: newStatus }, { merge: true });
                                        } catch (e) {
                                            console.error("Error updating status", e);
                                        }
                                    }}
                                >
                                    <Feather
                                        name="check"
                                        size={16}
                                        color={selectedTask.status === 'done' ? theme.colors.white : theme.colors.emerald[600]}
                                        style={{ marginRight: theme.spacing[2] }}
                                    />
                                    <Text weight="medium" style={{
                                        color: selectedTask.status === 'done' ? theme.colors.white : theme.colors.emerald[600],
                                        fontSize: 13
                                    }}>
                                        {selectedTask.status === 'done' ? 'Completed' : 'Mark Complete'}
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.headerIcons}>
                                    <TouchableOpacity style={styles.iconButton}>
                                        <Feather name="paperclip" size={20} color={theme.colors.muted.foreground} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton}>
                                        <Feather name="thumbs-up" size={20} color={theme.colors.muted.foreground} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => setSelectedTask(null)}>
                                        <Feather name="x" size={20} color={theme.colors.foreground} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                                {/* Title */}
                                <TextInput
                                    style={styles.asanaTitleInput}
                                    value={selectedTask.title}
                                    multiline
                                    onChangeText={(text) => setSelectedTask({ ...selectedTask, title: text })}
                                    onEndEditing={async () => {
                                        // Auto-save title
                                        try {
                                            await setDoc(doc(db, "tasks", selectedTask.id), { title: selectedTask.title }, { merge: true });
                                        } catch (e) { }
                                    }}
                                />

                                {/* Meta Fields */}
                                <View style={styles.metaContainer}>
                                    <View style={styles.metaRow}>
                                        <Text style={styles.metaLabel}>Assignee</Text>
                                        <TouchableOpacity
                                            style={styles.metaValueContainer}
                                            onPress={() => handlePickContact(false)}
                                        >
                                            <View style={styles.assigneeAvatar}>
                                                <Text style={{ color: theme.colors.white, fontSize: 10, fontWeight: 'bold' }}>
                                                    {(selectedTask.assignee || 'U').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text style={styles.metaValueText}>{selectedTask.assignee || 'Unassigned'}</Text>
                                            <Feather name="chevron-down" size={14} color={theme.colors.muted.foreground} style={{ marginLeft: 6 }} />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.metaRow}>
                                        <Text style={styles.metaLabel}>Start date</Text>
                                        {Platform.OS === 'ios' ? (
                                            <DateTimePicker
                                                testID="startDatePicker"
                                                value={selectedTask.startDate ? new Date(selectedTask.startDate) : new Date()}
                                                mode={'date'}
                                                display="compact"
                                                onChange={onStartDateChange}
                                                accentColor={theme.colors.primary.DEFAULT}
                                                themeVariant="light"
                                                textColor={theme.colors.foreground}
                                                style={{ alignSelf: 'flex-start' }}
                                            />
                                        ) : (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.metaValueContainer}
                                                    onPress={() => setShowStartDatePicker(true)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Feather name="calendar" size={18} color={theme.colors.muted.foreground} />
                                                        <Text style={[styles.metaValueText, { marginLeft: theme.spacing[3] }]}>
                                                            {selectedTask.startDate ? formatDate(selectedTask.startDate) : 'Set date'}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                                {showStartDatePicker && (
                                                    <DateTimePicker
                                                        testID="dateTimePicker"
                                                        value={selectedTask.startDate ? new Date(selectedTask.startDate) : new Date()}
                                                        mode={'date'}
                                                        display="default"
                                                        onChange={onStartDateChange}
                                                        accentColor={theme.colors.primary.DEFAULT}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </View>

                                    <View style={styles.metaRow}>
                                        <Text style={styles.metaLabel}>Due date</Text>
                                        {Platform.OS === 'ios' ? (
                                            <DateTimePicker
                                                testID="dueDatePicker"
                                                value={selectedTask.dueDate ? new Date(selectedTask.dueDate) : new Date()}
                                                mode={'date'}
                                                display="compact"
                                                onChange={onDueDateChange}
                                                accentColor={theme.colors.primary.DEFAULT}
                                                themeVariant="light"
                                                textColor={theme.colors.foreground}
                                                minimumDate={selectedTask.startDate ? new Date(selectedTask.startDate) : undefined}
                                                style={{ alignSelf: 'flex-start' }}
                                            />
                                        ) : (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.metaValueContainer}
                                                    onPress={() => setShowDueDatePicker(true)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Feather name="calendar" size={18} color={theme.colors.muted.foreground} />
                                                        <Text style={[styles.metaValueText, { marginLeft: theme.spacing[3] }]}>
                                                            {selectedTask.dueDate ? formatDate(selectedTask.dueDate) : 'Set date'}
                                                        </Text>
                                                    </View>
                                                    {selectedTask.status === 'done' && (
                                                        <Text style={{ marginLeft: theme.spacing[3], color: theme.colors.emerald[600], fontSize: 13 }}>Done</Text>
                                                    )}
                                                </TouchableOpacity>
                                                {showDueDatePicker && (
                                                    <DateTimePicker
                                                        testID="dateTimePicker"
                                                        value={selectedTask.dueDate ? new Date(selectedTask.dueDate) : new Date()}
                                                        mode={'date'}
                                                        display="default"
                                                        onChange={onDueDateChange}
                                                        accentColor={theme.colors.primary.DEFAULT}
                                                        minimumDate={selectedTask.startDate ? new Date(selectedTask.startDate) : undefined}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </View>

                                    <View style={styles.metaRow}>
                                        <Text style={styles.metaLabel}>Projects</Text>
                                        <View style={styles.metaValueContainer}>
                                            <View style={styles.projectBadge}>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary.DEFAULT }}>{projectName}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Description */}
                                <View style={styles.descriptionContainer}>
                                    <Text weight="medium" style={{ marginBottom: theme.spacing[2], fontSize: 14 }}>Description</Text>
                                    <TextInput
                                        style={styles.descriptionInput}
                                        value={selectedTask.description}
                                        multiline
                                        placeholder="What is this task about?"
                                        placeholderTextColor={theme.colors.muted.foreground}
                                        onChangeText={(text) => setSelectedTask({ ...selectedTask, description: text })}
                                        onEndEditing={async () => {
                                            try {
                                                await setDoc(doc(db, "tasks", selectedTask.id), { description: selectedTask.description }, { merge: true });
                                            } catch (e) { }
                                        }}
                                    />
                                </View>

                                {/* Fake Comment Box */}
                                <View style={styles.commentSection}>
                                    <View style={styles.commentAvatar} />
                                    <Text style={{ color: theme.colors.muted.foreground, marginLeft: theme.spacing[3] }}>Ask a question or post an update...</Text>
                                </View>

                            </ScrollView>
                        </View>
                    )}
                </BottomSheet>
                {/* Move Task Menu */}
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={!!moveMenuTask}
                    onRequestClose={() => setMoveMenuTask(null)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setMoveMenuTask(null)}
                    >
                        <Card style={{ width: 280, padding: 0 }}>
                            <View style={{ padding: theme.spacing[4], borderBottomWidth: 1, borderBottomColor: theme.colors.gray[100] }}>
                                <Text weight="medium">Move to...</Text>
                            </View>
                            {moveMenuTask?.status !== 'backlog' && (
                                <TouchableOpacity
                                    style={styles.moveMenuItem}
                                    onPress={() => moveTask(moveMenuTask, 'backlog')}
                                >
                                    <View style={[styles.statusDot, { backgroundColor: theme.colors.gray[400] }]} />
                                    <Text>Backlog</Text>
                                </TouchableOpacity>
                            )}
                            {moveMenuTask?.status !== 'in-progress' && (
                                <TouchableOpacity
                                    style={styles.moveMenuItem}
                                    onPress={() => moveTask(moveMenuTask, 'in-progress')}
                                >
                                    <View style={[styles.statusDot, { backgroundColor: theme.colors.primary.DEFAULT }]} />
                                    <Text>In Progress</Text>
                                </TouchableOpacity>
                            )}
                            {moveMenuTask?.status !== 'done' && (
                                <TouchableOpacity
                                    style={styles.moveMenuItem}
                                    onPress={() => moveTask(moveMenuTask, 'done')}
                                >
                                    <View style={[styles.statusDot, { backgroundColor: theme.colors.emerald?.[600] || '#059669' }]} />
                                    <Text>Done</Text>
                                </TouchableOpacity>
                            )}
                        </Card>
                    </TouchableOpacity>
                </Modal>
            </View>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50],
    },
    header: {
        padding: theme.spacing[4],
        backgroundColor: theme.colors.white,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing[4],
    },
    backButton: {
        marginRight: theme.spacing[4],
        padding: theme.spacing[1],
    },
    headerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: theme.colors.gray[100],
        padding: 2,
        borderRadius: theme.radius.md,
    },
    toggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.sm,
    },
    toggleBtnActive: {
        backgroundColor: theme.colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleText: {
        marginLeft: theme.spacing[2],
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.foreground,
    },
    toggleTextActive: {
        color: theme.colors.primary.DEFAULT,
        fontWeight: '600',
    },
    board: {
        flex: 1,
    },
    boardContent: {
        padding: theme.spacing[4],
        paddingBottom: theme.spacing[24],
    },
    column: {
        width: COLUMN_WIDTH,
        backgroundColor: theme.colors.gray[100],
        marginRight: theme.spacing[4],
        borderRadius: theme.radius.lg,
        padding: theme.spacing[2],
    },
    columnHeader: {
        padding: theme.spacing[2],
        marginBottom: theme.spacing[2],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    columnScroll: {
        flex: 1,
    },
    taskCard: {
        marginBottom: theme.spacing[2],
        borderWidth: 0,
        shadowOpacity: 0.05,
    },

    // List View Styles
    listContainer: {
        flex: 1,
        backgroundColor: theme.colors.gray[50],
    },
    listSection: {
        marginBottom: theme.spacing[6],
    },
    listSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing[2],
        paddingVertical: theme.spacing[1],
    },
    listCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing[4],
        backgroundColor: theme.colors.white,
        marginBottom: theme.spacing[2],
        borderRadius: theme.radius.lg,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: theme.colors.gray[100],
    },
    countBadge: {
        backgroundColor: theme.colors.gray[200],
        paddingHorizontal: theme.spacing[2],
        paddingVertical: 1,
        borderRadius: theme.radius.full,
    },
    miniBadge: {
        backgroundColor: theme.colors.primary.light,
        paddingHorizontal: theme.spacing[2],
        paddingVertical: 2,
        borderRadius: theme.radius.sm,
    },

    // FAB Styles
    fabContainer: {
        position: 'absolute',
        bottom: theme.spacing[8],
        right: theme.spacing[6],
        flexDirection: 'row',
        alignItems: 'center',
    },
    fab: {
        shadowColor: theme.colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        borderRadius: theme.radius.full,
    },
    secondaryFab: {
        width: 48,
        height: 48,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        marginLeft: theme.spacing[3],
    },
    menuContainer: {
        position: 'absolute',
        bottom: 70,
        right: 0,
        width: 180,
        backgroundColor: theme.colors.white,
        padding: 0,
        zIndex: 1000,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray[100],
    },

    badge: {
        backgroundColor: theme.colors.gray[400],
        paddingHorizontal: theme.spacing[2],
        paddingVertical: 2,
        borderRadius: theme.radius.full,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: theme.spacing[6],
    },
    modalView: {
        width: '100%',
        maxWidth: 400,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: theme.spacing[4],
    },

    // Sheet Styles
    // Styles moved to BottomSheet component
    sheetOverlay: {
        // Obsolete
    },
    sheetContent: {
        // Obsolete
    },
    sheetHandle: {
        // Obsolete
    },

    // Asana Styles
    asanaHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing[6],
        paddingBottom: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray[100],
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderWidth: 1,
        borderColor: theme.colors.emerald[600] || 'green',
        borderRadius: theme.radius.sm,
    },
    completeButtonActive: {
        backgroundColor: theme.colors.emerald[600] || 'green',
        borderColor: theme.colors.emerald[600] || 'green',
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        marginLeft: theme.spacing[4],
    },
    asanaTitleInput: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.foreground,
        marginBottom: theme.spacing[6],
        padding: 0,
    },
    metaContainer: {
        marginBottom: theme.spacing[8],
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing[4],
        minHeight: 32,
    },
    metaLabel: {
        width: 100,
        fontSize: 14,
        color: theme.colors.muted.foreground,
    },
    metaValueContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    assigneeAvatar: {
        width: 24,
        height: 24,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing[2],
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: theme.radius.full,
    },
    metaValueText: {
        fontSize: 14,
        color: theme.colors.foreground,
    },
    projectBadge: {
        backgroundColor: theme.colors.primary.light,
        paddingHorizontal: theme.spacing[2],
        paddingVertical: 2,
        borderRadius: theme.radius.md,
    },
    descriptionContainer: {
        marginBottom: theme.spacing[6],
        minHeight: 100,
    },
    descriptionInput: {
        fontSize: 14,
        color: theme.colors.foreground,
        lineHeight: 22,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    commentSection: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: theme.spacing[4],
        borderTopWidth: 1,
        borderTopColor: theme.colors.gray[100],
        marginBottom: theme.spacing[8],
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.gray[300],
    },
    moveMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.gray[100],
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: theme.spacing[3],
    },

    // New Header Styles
    newHeader: {
        backgroundColor: theme.colors.white,
        paddingTop: theme.spacing[2],
        paddingBottom: theme.spacing[4],
        paddingHorizontal: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    newHeaderTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing[6],
    },
    backButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 16,
        color: theme.colors.foreground,
        marginLeft: theme.spacing[1],
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    roundButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.gray[200], // light border
        marginLeft: theme.spacing[2],
        borderStyle: 'dashed', // visual cue for placeholder "plus" ? Or just solid. User said "placeholder".
        // Actually for the "plus" it should probably be solid.
        borderStyle: 'solid',
    },
    newHeaderProjectRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    projectIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24, // Circle
        backgroundColor: theme.colors.gray[50],
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing[4],
        // borderWidth: 1, // Removed border
        // borderColor: theme.colors.gray[200],
    },
    projectTitleText: {
        fontSize: 24, // H1ish
        fontWeight: 'bold',
        color: theme.colors.foreground,
    },

    // View Toogle Tabs (Restored)
    viewToggleRow: {
        marginTop: theme.spacing[4],
        flexDirection: 'row',
    },
    viewToggleContainer: {
        flexDirection: 'row',
        backgroundColor: theme.colors.gray[100],
        padding: 4,
        borderRadius: theme.radius.md,
    },
    viewToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.radius.sm,
    },
    viewToggleBtnActive: {
        backgroundColor: theme.colors.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    viewToggleText: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.colors.muted.foreground,
        marginLeft: 6,
    },
    viewToggleTextActive: {
        color: theme.colors.primary.DEFAULT,
        fontWeight: '600',
    },

    // Header Menu
    headerMenuDropdown: {
        position: 'absolute',
        top: 120,
        right: 20,
        backgroundColor: theme.colors.white,
        borderRadius: theme.radius.md,
        padding: theme.spacing[2],
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        minWidth: 160,
    },
    headerMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing[3],
        borderRadius: theme.radius.sm, // hover effect area
    },

    // Delete Modal
    deleteConfirmCard: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: theme.colors.white,
        padding: theme.spacing[6],
    },

    // Icon Picker
    iconPickerCard: {
        width: '90%',
        maxWidth: 340,
        backgroundColor: theme.colors.white,
        padding: theme.spacing[6],
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
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
    }
});
