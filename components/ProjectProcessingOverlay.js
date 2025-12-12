import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Modal } from 'react-native';
import { theme } from '../theme';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { Feather } from '@expo/vector-icons';
import { storage, db, auth } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, doc, onSnapshot } from 'firebase/firestore';

export default function ProjectProcessingOverlay({ isVisible, projectData, onComplete, onError }) {
    const [status, setStatus] = useState('Starting...');
    const [internalError, setInternalError] = useState(null);
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isVisible && projectData) {
            setInternalError(null);
            setStatus('Initializing...');
            startAnimation();
            processProject();
        }
    }, [isVisible, projectData]);

    const startAnimation = () => {
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true
            })
        ).start();
    };

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const processProject = async () => {
        const { projectName, quoteUri, startDate, deadline, durationWeeks } = projectData;

        try {
            // 1. Upload Image
            setStatus('Uploading your quote...');
            const response = await fetch(quoteUri);
            const blob = await response.blob();
            const filename = `quotes/${auth.currentUser.uid}_${Date.now()}.jpg`;
            const storageRef = ref(storage, filename);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            // 2. Create Project
            setStatus('Setting up project...');
            const projectRef = await addDoc(collection(db, "projects"), {
                name: projectName,
                ownerId: auth.currentUser.uid, // Required for Dashboard visibility
                startDate,
                deadline,
                durationWeeks,
                icon: projectData.icon || 'list',
                createdAt: new Date(),
                status: 'active'
            });

            // 3. Create Trigger Task (AI)
            setStatus('Analyzing construction plan...');
            const triggerTaskRef = await addDoc(collection(db, "tasks"), {
                title: "Processing Project Quote",
                description: "AI is analyzing the quote to generate tasks.",
                status: "backlog",
                projectId: projectRef.id,
                projectStartDate: startDate,
                projectDeadline: deadline,
                quoteUrl: downloadURL,
                createdAt: new Date(),
                assignee: "AI_BOT",
                // This 'assigneePhone' might be needed if your backend relies on it, 
                // but for now passing null as per previous implementation logic.
                assigneePhone: null
            });

            // 4. Listen for completion
            const unsubscribe = onSnapshot(doc(db, "tasks", triggerTaskRef.id), (docSnap) => {
                const data = docSnap.data();
                if (data) {
                    if (data.status === 'done') {
                        setStatus('Finalizing setup...');
                        unsubscribe();
                        onComplete(projectRef.id);
                    } else if (data.status === 'error') {
                        setStatus('Error');
                        const msg = data.description || "AI processing failed.";
                        setInternalError(msg);
                        if (onError) onError(msg);
                        unsubscribe();
                    }
                }
            });

        } catch (err) {
            console.error(err);
            setInternalError(err.message);
            setStatus('Something went wrong.');
            if (onError) onError(err.message);
        }
    };

    if (!isVisible) return null;

    return (
        <Modal visible={isVisible} animationType="fade" transparent={false}>
            <View style={styles.container}>
                {internalError ? (
                    <View style={styles.content}>
                        <Feather name="alert-circle" size={48} color={theme.colors.destructive.DEFAULT} />
                        <Text variant="h3" style={{ marginTop: 16 }}>Error</Text>
                        <Text variant="muted" style={{ textAlign: 'center', marginVertical: 8 }}>{internalError}</Text>
                        <Button onPress={() => {
                            if (onError) onError(internalError);
                        }}>Close</Button>
                    </View>
                ) : (
                    <View style={styles.content}>
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Feather name="loader" size={64} color={theme.colors.primary.DEFAULT} />
                        </Animated.View>

                        <Text variant="h3" style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}>
                            {status}
                        </Text>

                        <Text variant="muted" align="center" style={{ maxWidth: 300 }}>
                            We are reading your quote effectively to schedule tasks.
                        </Text>

                        <View style={styles.tipsContainer}>
                            <Text variant="small" style={{ fontWeight: 'bold', marginBottom: 8 }}>DID YOU KNOW?</Text>
                            <Text variant="small" align="center" style={{ color: theme.colors.gray[600] }}>
                                You can assign these tasks to your team via WhatsApp later.
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50], // Or white, to cover everything
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        padding: theme.spacing[6],
        width: '100%',
    },
    tipsContainer: {
        marginTop: 60,
        padding: theme.spacing[6],
        backgroundColor: 'white',
        borderRadius: theme.radius.lg,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        width: '90%',
    }
});
