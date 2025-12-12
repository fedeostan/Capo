import React, { useState } from 'react';
import { View, StyleSheet, Image, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from '../firebaseConfig';
import { addDoc, collection } from 'firebase/firestore';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Text } from '../components/ui/Text';
import { Card, CardContent } from '../components/ui/Card';
import { Feather } from '@expo/vector-icons';

export default function UploadQuoteScreen({ route, navigation }) {
    const { projectId } = route.params;
    const [image, setImage] = useState(null);
    const [uploading, setUploading] = useState(false);

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
            alert('Sorry, we need camera permissions to make this work!');
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

    const handleUpload = async () => {
        if (!image) return;
        setUploading(true);

        try {
            const response = await fetch(image);
            const blob = await response.blob();
            const filename = image.substring(image.lastIndexOf('/') + 1);
            const storageRef = ref(storage, `quotes/${filename}`);

            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);

            await addDoc(collection(db, "tasks"), {
                title: "Processing Quote...",
                description: "AI is analyzing this quote for tasks. please wait.",
                status: "backlog",
                projectId: projectId,
                quoteUrl: downloadURL,
                createdAt: new Date(),
                assignee: "AI_BOT"
            });

            alert("Quote uploaded! AI is processing it.");
            navigation.goBack();

        } catch (error) {
            console.error(error);
            alert("Upload failed: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Feather name="arrow-left" size={24} color={theme.colors.foreground} />
                </TouchableOpacity>
                <View>
                    <Text variant="h3">Upload Quote</Text>
                    <Text variant="muted">Capture a quote to auto-generate tasks.</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {image ? (
                    <Card style={styles.previewCard}>
                        <Image source={{ uri: image }} style={styles.preview} />
                        <Button
                            variant="ghost"
                            size="sm"
                            onPress={() => setImage(null)}
                            style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.8)' }}
                        >
                            <Text variant="small">Clear</Text>
                        </Button>
                    </Card>
                ) : (
                    <Card style={styles.placeholderCard}>
                        <CardContent style={{ alignItems: 'center', padding: theme.spacing[8] }}>
                            <Text variant="lead" style={{ marginBottom: theme.spacing[4] }}>No image selected</Text>
                            <Text variant="small" style={{ textAlign: 'center' }}>Take a photo or upload from gallery to get started.</Text>
                        </CardContent>
                    </Card>
                )}

                <View style={styles.actions}>
                    <View style={styles.buttonRow}>
                        <Button variant="outline" onPress={pickImage} style={{ flex: 1, marginRight: theme.spacing[2] }}>
                            Gallery
                        </Button>
                        <Button variant="outline" onPress={takePhoto} style={{ flex: 1, marginLeft: theme.spacing[2] }}>
                            Camera
                        </Button>
                    </View>

                    {image && (
                        <Button
                            onPress={handleUpload}
                            loading={uploading}
                            size="lg"
                            style={{ marginTop: theme.spacing[4] }}
                        >
                            {uploading ? 'Processing...' : 'Process Quote'}
                        </Button>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50], // Light background
    },
    header: {
        padding: theme.spacing[6],
        backgroundColor: theme.colors.white,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        marginRight: theme.spacing[4],
        padding: theme.spacing[1],
    },
    content: {
        padding: theme.spacing[6],
        alignItems: 'center',
    },
    previewCard: {
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
        marginBottom: theme.spacing[6],
        padding: 0,
    },
    placeholderCard: {
        width: '100%',
        maxWidth: 400,
        marginBottom: theme.spacing[6],
        borderStyle: 'dashed',
        backgroundColor: theme.colors.gray[100],
    },
    preview: {
        width: '100%',
        height: 400,
        resizeMode: 'cover',
    },
    actions: {
        width: '100%',
        maxWidth: 400,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
});
