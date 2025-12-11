import React, { useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Modal, SafeAreaView } from 'react-native';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

export default function DashboardScreen({ navigation }) {
    const [projects, setProjects] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Listen to projects created by this user
        const q = query(collection(db, "projects"), where("ownerId", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const projectsData = [];
            snapshot.forEach((doc) => {
                projectsData.push({ id: doc.id, ...doc.data() });
            });
            setProjects(projectsData);
        });

        return () => unsubscribe();
    }, []);

    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;

        try {
            await addDoc(collection(db, "projects"), {
                name: newProjectName,
                ownerId: auth.currentUser.uid,
                createdAt: new Date(),
                status: 'active'
            });
            setNewProjectName('');
            setModalVisible(false);
        } catch (error) {
            alert("Error creating project: " + error.message);
        }
    };

    const handleLogout = () => {
        signOut(auth);
    };

    const renderProjectItem = ({ item }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, projectName: item.name })}
        >
            <Card style={styles.projectCard}>
                <CardHeader>
                    <View style={styles.projectHeader}>
                        <CardTitle>{item.name}</CardTitle>
                        <Text variant="small" style={{ color: theme.colors.emerald?.[600] || 'green' }}>{item.status}</Text>
                    </View>
                </CardHeader>
                <CardContent>
                    <Text variant="muted">Tap to view details</Text>
                </CardContent>
            </Card>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text variant="h2">My Projects</Text>
                <Button variant="ghost" onPress={handleLogout} size="sm">
                    <Text style={{ color: theme.colors.destructive.DEFAULT }}>Log Out</Text>
                </Button>
            </View>

            <FlatList
                data={projects}
                renderItem={renderProjectItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
            />

            <View style={styles.fabContainer}>
                <Button onPress={() => setModalVisible(true)} size="lg" style={styles.fab}>
                    + New Project
                </Button>
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
                            <CardTitle>New Project</CardTitle>
                            <CardDescription>Enter the name for your new project.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                placeholder="Project Name"
                                value={newProjectName}
                                onChangeText={setNewProjectName}
                                autoFocus
                            />
                            <View style={styles.modalButtons}>
                                <Button
                                    variant="outline"
                                    onPress={() => setModalVisible(false)}
                                    style={{ flex: 1, marginRight: theme.spacing[2] }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onPress={handleCreateProject}
                                    style={{ flex: 1, marginLeft: theme.spacing[2] }}
                                >
                                    Create
                                </Button>
                            </View>
                        </CardContent>
                    </Card>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50],
    },
    header: {
        padding: theme.spacing[6],
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    list: {
        padding: theme.spacing[6],
        paddingTop: 0,
    },
    projectCard: {
        marginBottom: theme.spacing[4],
    },
    projectHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing[2],
    },
    fabContainer: {
        position: 'absolute',
        bottom: theme.spacing[8],
        right: theme.spacing[6],
    },
    fab: {
        shadowColor: theme.colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
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
});
