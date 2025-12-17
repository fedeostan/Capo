import React, { useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Platform } from 'react-native';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { signOut } from 'firebase/auth';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import ProjectProcessingOverlay from '../components/ProjectProcessingOverlay';

import { DeviceEventEmitter } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/ui/Header';

export default function DashboardScreen({ navigation }) {
    const [projects, setProjects] = useState([]);
    const [processingData, setProcessingData] = useState(null);

    useEffect(() => {
        // Listener for Project Creation from Modal
        const subscription = DeviceEventEmitter.addListener('create-project-processing', (data) => {
            // Wait for the modal to dismiss before showing the overlay
            const timer = setTimeout(() => {
                setProcessingData(data);
            }, 600);
            return () => clearTimeout(timer);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Listen to projects created by this user
        const q = query(collection(db, "projects"), where("ownerId", "==", user.uid));
        const unsubscribeProjects = onSnapshot(q, (snapshot) => {
            const projectsData = [];
            snapshot.forEach((doc) => {
                projectsData.push({ id: doc.id, ...doc.data() });
            });
            setProjects(projectsData);
        });

        return () => unsubscribeProjects();
    }, []);

    const handleProcessingComplete = (projectId) => {
        setProcessingData(null);
        // Optionally navigate to details or just stay on dashboard
        // navigation.navigate('ProjectDetail', { projectId });
    };

    const handleProcessingError = (error) => {
        // Overlay handles display, but if closed:
        setProcessingData(null);
    };

    const handleLogout = () => {
        signOut(auth);
    };

    const renderProjectItem = ({ item }) => {

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, projectName: item.name })}
            >
                <Card style={styles.projectCard}>
                    <CardHeader>
                        <View style={styles.projectHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{
                                    width: 40, height: 40, borderRadius: 20,
                                    backgroundColor: theme.colors.gray[100],
                                    justifyContent: 'center', alignItems: 'center',
                                    marginRight: 12
                                }}>
                                    <Feather name={item.icon || 'list'} size={20} color={theme.colors.primary.DEFAULT} />
                                </View>
                                <CardTitle>{item.name}</CardTitle>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text variant="small" style={{ color: theme.colors.emerald?.[600] || 'green' }}>{item.status}</Text>
                            </View>
                        </View>
                    </CardHeader>
                    <CardContent>
                        <Text variant="muted">Tap to view details</Text>
                    </CardContent>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="My Projects"
                showBack={false}
                rightAction={
                    <Button variant="ghost" onPress={handleLogout} size="sm">
                        <Text style={{ color: theme.colors.destructive.DEFAULT }}>Log Out</Text>
                    </Button>
                }
            />

            <FlatList
                data={projects}
                renderItem={renderProjectItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
            />

            <View style={styles.fabContainer}>
                <Button onPress={() => navigation.navigate('ProjectCreateModal')} size="lg" style={styles.fab}>
                    + New Project
                </Button>
            </View>

            {/* Processing Overlay */}
            <ProjectProcessingOverlay
                isVisible={!!processingData}
                projectData={processingData}
                onComplete={handleProcessingComplete}
                onError={handleProcessingError}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50],
    },

    list: {
        padding: theme.spacing[6],
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
        bottom: Platform.OS === 'android' ? theme.spacing[12] : theme.spacing[8],
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

    notificationBadge: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: theme.colors.destructive.DEFAULT,
        marginRight: 8,
    }
});
