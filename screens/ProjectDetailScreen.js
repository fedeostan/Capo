import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, SafeAreaView, Dimensions, FlatList, TextInput } from 'react-native';
import { DraxProvider, DraxView, DraxScrollView } from 'react-native-drax';
import { collection, query, where, onSnapshot, addDoc, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Feather } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';

const COLUMN_WIDTH = 300;

export default function ProjectDetailScreen({ route, navigation }) {
    const { projectId, projectName } = route.params;
    const [tasks, setTasks] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');
    const [newTaskStartDate, setNewTaskStartDate] = useState('');
    const [newTaskDuration, setNewTaskDuration] = useState('');
    const [newTaskDependencies, setNewTaskDependencies] = useState([]); // Array of task IDs
    const [dependencyModalVisible, setDependencyModalVisible] = useState(false);
    const [newTaskAssignee, setNewTaskAssignee] = useState('');
    const [newTaskPhone, setNewTaskPhone] = useState('');
    const [conflictWarning, setConflictWarning] = useState(null);
    const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'
    const [collapsedSections, setCollapsedSections] = useState({});
    const [menuVisible, setMenuVisible] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

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
    }, [projectId]);

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

    const handlePickContact = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const contact = await Contacts.presentContactPickerAsync();
                if (contact) {
                    setNewTaskAssignee(contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`);
                    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
                        // Simple normalization, remove non-digits
                        const rawPhone = contact.phoneNumbers[0].number;
                        // const cleanPhone = rawPhone.replace(/\D/g, ''); 
                        // Keep format but maybe ensure it has country code if possible. 
                        // For now just use what we get, user can edit.
                        setNewTaskPhone(rawPhone);

                        // Check conflicts immediately if we have dates
                        const conflict = checkConflicts(rawPhone, newTaskStartDate, newTaskDuration);
                        setConflictWarning(conflict ? `Conflict with task "${conflict.title}"` : null);
                    }
                }
            } else {
                alert('Permission to access contacts was denied');
            }
        } catch (e) {
            console.log(e);
            // Fallback or error handling
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
                assigneePhone: newTaskPhone,
                status: 'backlog',
                projectId: projectId,
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

    const renderTaskCard = (task) => (
        <DraxView
            key={task.id}
            dragPayload={{ task }}
            longPressDelay={150}

            renderContent={({ viewState }) => (
                <View style={{ opacity: viewState && viewState.isDragging ? 0.3 : 1 }}>
                    <TouchableOpacity onPress={() => setSelectedTask(task)} activeOpacity={0.9}>
                        <Card style={styles.taskCard}>
                            <CardHeader style={{ padding: theme.spacing[3], paddingBottom: 0 }}>
                                <Text weight="medium">{task.title}</Text>
                            </CardHeader>
                            <CardContent style={{ padding: theme.spacing[3] }}>
                                <Text variant="muted" style={{ marginBottom: theme.spacing[1] }} numberOfLines={2}>{task.description}</Text>
                                <Text variant="small" style={{ fontStyle: 'italic', color: theme.colors.primary.DEFAULT }}>
                                    {task.assignee ? `Assigned to: ${task.assignee}` : 'Unassigned'}
                                </Text>
                                {task.dueDate && (
                                    <Text variant="small" style={{ color: theme.colors.muted.foreground, marginTop: 4 }}>
                                        Due: {task.dueDate}
                                    </Text>
                                )}
                            </CardContent>
                        </Card>
                    </TouchableOpacity>
                </View>
            )}
            renderHoverContent={() => (
                <Card style={[styles.taskCard, { width: 280, transform: [{ rotate: '5deg' }], shadowOpacity: 0.2 }]}>
                    <CardHeader style={{ padding: theme.spacing[3], paddingBottom: 0 }}>
                        <Text weight="medium">{task.title}</Text>
                    </CardHeader>
                    <CardContent style={{ padding: theme.spacing[3] }}>
                        <Text variant="muted">Dragging...</Text>
                    </CardContent>
                </Card>
            )}
        />
    );

    const renderListRow = (task) => (
        <DraxView
            key={task.id}
            dragPayload={{ task }}
            longPressDelay={150}
            renderContent={({ viewState }) => (
                <View style={{ opacity: viewState && viewState.isDragging ? 0.3 : 1 }}>
                    <TouchableOpacity onPress={() => setSelectedTask(task)} activeOpacity={0.9}>
                        <Card style={styles.listCard}>
                            <View style={{ flex: 1 }}>
                                <Text weight="medium">{task.title}</Text>
                                <Text variant="muted" style={{ fontSize: 13, marginTop: 4 }} numberOfLines={1}>{task.description}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.miniBadge}>
                                    <Text variant="small" style={{ fontSize: 10, color: theme.colors.primary.DEFAULT }}>
                                        {task.assignee || 'Unassigned'}
                                    </Text>
                                </View>
                                <TouchableOpacity style={{ marginLeft: theme.spacing[3] }}>
                                    <Feather name="more-horizontal" size={16} color={theme.colors.muted.foreground} />
                                </TouchableOpacity>
                            </View>
                        </Card>
                    </TouchableOpacity>
                </View>
            )}
            renderHoverContent={() => (
                <Card style={[styles.listCard, { width: Dimensions.get('window').width - 40, transform: [{ rotate: '2deg' }], shadowOpacity: 0.1 }]}>
                    <View style={{ flex: 1 }}>
                        <Text weight="medium">{task.title}</Text>
                    </View>
                </Card>
            )}
        />
    );

    const renderListSection = (title, data, sectionKey) => {
        const isCollapsed = collapsedSections[sectionKey];
        return (
            <DraxView
                style={styles.listSection}
                receivingStyle={[styles.listSection, { borderColor: theme.colors.primary.DEFAULT, borderWidth: 2, borderRadius: theme.radius.lg, padding: 4 }]}
                onReceiveDragDrop={(event) => handleTaskDrop(event, sectionKey)}
            >
                <TouchableOpacity onPress={() => toggleSection(sectionKey)} style={styles.listSectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name={isCollapsed ? "chevron-right" : "chevron-down"} size={18} color={theme.colors.foreground} style={{ marginRight: theme.spacing[2] }} />
                        <Text variant="h4" style={{ fontSize: 18 }}>{title}</Text>
                    </View>
                    <View style={styles.countBadge}>
                        <Text variant="small" weight="bold" style={{ color: theme.colors.muted.foreground }}>{data.length}</Text>
                    </View>
                </TouchableOpacity>
                {!isCollapsed && (
                    <View>
                        {data.map(renderListRow)}
                        {data.length === 0 && (
                            <View style={{ padding: theme.spacing[4], alignItems: 'center' }}>
                                <Text variant="small" style={{ fontStyle: 'italic', color: theme.colors.muted.foreground }}>Drop tasks here</Text>
                            </View>
                        )}
                    </View>
                )}
            </DraxView>
        );
    };

    const handleTaskDrop = async (event, newStatus) => {
        const { task } = event.dragged.payload;
        if (task.status !== newStatus) {
            // Optimistic Update
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

            try {
                await setDoc(doc(db, "tasks", task.id), { status: newStatus }, { merge: true });
            } catch (e) {
                console.error("Drop update failed", e);
            }
        }
    };

    const renderColumn = (title, columnTasks, statusId, badgeColor = theme.colors.gray[400]) => (
        <DraxView
            style={styles.column}
            receivingStyle={[styles.column, { borderColor: theme.colors.primary.DEFAULT, borderWidth: 2 }]}
            onReceiveDragDrop={(event) => handleTaskDrop(event, statusId)}
        >
            <View style={styles.columnHeader}>
                <Text variant="large" weight="bold">{title}</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor }]}><Text variant="small" style={{ color: theme.colors.white }}>{columnTasks.length}</Text></View>
            </View>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                {columnTasks.map(renderTaskCard)}
                <View style={{ height: 100 }} />
            </ScrollView>
        </DraxView>
    );

    const backlogTasks = tasks.filter(t => t.status === 'backlog');
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
    const doneTasks = tasks.filter(t => t.status === 'done');

    return (
        <DraxProvider>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Feather name="arrow-left" size={24} color={theme.colors.foreground} />
                        </TouchableOpacity>
                        <View>
                            <Text variant="h3">{projectName}</Text>
                            <Text variant="muted">Project Board</Text>
                        </View>
                    </View>

                    <View style={styles.controlsRow}>
                        <View style={styles.viewToggle}>
                            <TouchableOpacity
                                style={[styles.toggleBtn, viewMode === 'board' && styles.toggleBtnActive]}
                                onPress={() => setViewMode('board')}
                            >
                                <Feather name="columns" size={16} color={viewMode === 'board' ? theme.colors.primary.foreground : theme.colors.foreground} />
                                <Text style={[styles.toggleText, viewMode === 'board' && styles.toggleTextActive]}>Board</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
                                onPress={() => setViewMode('list')}
                            >
                                <Feather name="list" size={16} color={viewMode === 'list' ? theme.colors.primary.foreground : theme.colors.foreground} />
                                <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
                            </TouchableOpacity>
                        </View>
                        {/* Header Actions removed */}
                    </View>
                </View>

                {viewMode === 'board' ? (
                    <ScrollView
                        style={styles.board}
                        horizontal={true}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.boardContent}
                    >
                        {renderColumn('Backlog', backlogTasks, 'backlog', theme.colors.gray[400])}
                        {renderColumn('In Progress', inProgressTasks, 'in-progress', theme.colors.primary.DEFAULT)}
                        {renderColumn('Done', doneTasks, 'done', theme.colors.gray[600])}
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

                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <Card style={styles.modalView}>
                            <CardHeader>
                                <CardTitle>New Task</CardTitle>
                                <CardDescription>Create a new task for this project.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Input
                                    placeholder="Task Title"
                                    value={newTaskTitle}
                                    onChangeText={setNewTaskTitle}
                                />
                                <Input
                                    placeholder="Description"
                                    value={newTaskDescription}
                                    onChangeText={setNewTaskDescription}
                                    multiline
                                    numberOfLines={3}
                                    style={{ height: 80, textAlignVertical: 'top' }}
                                />
                                <Input
                                    placeholder="Due Date (e.g., 2024-12-31)"
                                    value={newTaskDueDate}
                                    onChangeText={setNewTaskDueDate}
                                />
                                <Input
                                    placeholder="Assignee Name"
                                    value={newTaskAssignee}
                                    onChangeText={setNewTaskAssignee}
                                />
                                <Input
                                    placeholder="Phone (e.g., +1234567890)"
                                    value={newTaskPhone}
                                    onChangeText={setNewTaskPhone}
                                    keyboardType="phone-pad"
                                />
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Input
                                        placeholder="Start Date (YYYY-MM-DD)"
                                        value={newTaskStartDate}
                                        onChangeText={(text) => {
                                            setNewTaskStartDate(text);
                                            const conflict = checkConflicts(newTaskPhone, text, newTaskDuration);
                                            setConflictWarning(conflict ? `Conflict with "${conflict.title}"` : null);
                                        }}
                                        style={{ flex: 1 }}
                                    />
                                    <Input
                                        placeholder="Duration (days)"
                                        value={newTaskDuration}
                                        onChangeText={(text) => {
                                            setNewTaskDuration(text);
                                            const conflict = checkConflicts(newTaskPhone, newTaskStartDate, text);
                                            setConflictWarning(conflict ? `Conflict with "${conflict.title}"` : null);
                                        }}
                                        keyboardType="numeric"
                                        style={{ flex: 1 }}
                                    />
                                </View>
                                <Button
                                    variant="outline"
                                    onPress={handlePickContact}
                                    style={{ marginTop: 8, marginBottom: 8, borderColor: theme.colors.primary.DEFAULT }}
                                >
                                    <Feather name="user-plus" size={16} color={theme.colors.primary.DEFAULT} style={{ marginRight: 8 }} />
                                    Choose from Contacts
                                </Button>

                                <Button
                                    variant="outline"
                                    onPress={() => setDependencyModalVisible(true)}
                                    style={{ marginTop: 8, marginBottom: 8 }}
                                >
                                    <Feather name="link" size={16} color={theme.colors.foreground} style={{ marginRight: 8 }} />
                                    Dependencies ({newTaskDependencies.length})
                                </Button>

                                {checkDependencyConflicts(newTaskStartDate, newTaskDependencies) && (
                                    <View style={{ backgroundColor: '#fff7ed', padding: 8, borderRadius: 4, marginTop: 4 }}>
                                        <Text style={{ color: '#c2410c', fontWeight: 'bold' }}>
                                            ⚠️ Starts before dependency "{checkDependencyConflicts(newTaskStartDate, newTaskDependencies).title}" ends.
                                        </Text>
                                    </View>
                                )}

                                {conflictWarning && (
                                    <View style={{ backgroundColor: '#fee2e2', padding: 8, borderRadius: 4, marginTop: 4 }}>
                                        <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ {conflictWarning}</Text>
                                    </View>
                                )}

                                <View style={styles.modalButtons}>
                                    <Button
                                        variant="outline"
                                        onPress={() => setModalVisible(false)}
                                        style={{ flex: 1, marginRight: theme.spacing[2] }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onPress={handleCreateTask}
                                        style={{ flex: 1, marginLeft: theme.spacing[2] }}
                                    >
                                        Add Task
                                    </Button>
                                </View>
                            </CardContent>
                        </Card>
                    </View>
                </Modal>



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
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={!!selectedTask}
                    onRequestClose={() => setSelectedTask(null)}
                >
                    <TouchableOpacity
                        style={styles.sheetOverlay}
                        activeOpacity={1}
                        onPress={() => setSelectedTask(null)}
                    >
                        <TouchableOpacity activeOpacity={1} style={styles.sheetContent}>
                            {selectedTask && (
                                <View style={{ flex: 1 }}>
                                    {/* Asana-style Handle */}
                                    <View style={styles.sheetHandle} />

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
                                                <View style={styles.metaValueContainer}>
                                                    <View style={styles.assigneeAvatar}>
                                                        <Text style={{ color: theme.colors.white, fontSize: 10, fontWeight: 'bold' }}>
                                                            {(selectedTask.assignee || 'U').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.metaValueText}>{selectedTask.assignee || 'Unassigned'}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.metaRow}>
                                                <Text style={styles.metaLabel}>Due date</Text>
                                                <View style={styles.metaValueContainer}>
                                                    <TouchableOpacity style={styles.dateBadge}>
                                                        <Feather name="calendar" size={14} color={theme.colors.muted.foreground} style={{ marginRight: 6 }} />
                                                        <Text style={styles.metaValueText}>{selectedTask.dueDate || 'No due date'}</Text>
                                                    </TouchableOpacity>
                                                    {selectedTask.status === 'done' && (
                                                        <Text style={{ marginLeft: theme.spacing[3], color: theme.colors.emerald[600], fontSize: 13 }}>Done</Text>
                                                    )}
                                                </View>
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
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            </SafeAreaView>
        </DraxProvider >
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
        maxHeight: '100%',
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
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContent: {
        backgroundColor: theme.colors.white,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        padding: theme.spacing[6],
        paddingBottom: theme.spacing[10],
        height: '92%',
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: theme.colors.gray[300],
        borderRadius: theme.radius.full,
        alignSelf: 'center',
        marginBottom: theme.spacing[4],
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
    }
});
