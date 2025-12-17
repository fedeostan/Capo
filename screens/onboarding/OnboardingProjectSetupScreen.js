import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Text } from '../../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Feather } from '@expo/vector-icons';

export default function OnboardingProjectSetupScreen({ navigation, route }) {
    const { isOnboarding } = route.params || {};
    const [projectName, setProjectName] = useState('');
    const [image, setImage] = useState(null);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
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
            allowsEditing: true,
            aspect: [3, 4],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleNext = () => {
        if (!projectName.trim()) {
            Alert.alert("Missing Name", "Please enter a project name.");
            return;
        }
        if (!image) {
            Alert.alert("Missing Quote", "Please upload a photo of your quote.");
            return;
        }

        navigation.navigate('ProjectTimeline', {
            projectName,
            quoteUri: image,
            isOnboarding
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    {isOnboarding && (
                        <View style={styles.steps}>
                            <Text variant="small" style={{ color: theme.colors.primary.DEFAULT, fontWeight: 'bold' }}>STEP 2 OF 3</Text>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: '66%' }]} />
                            </View>
                        </View>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>{isOnboarding ? "First Project Setup" : "New Project Setup"}</CardTitle>
                            <CardDescription>Let's get your project ready.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                label="Project Name"
                                placeholder="e.g. Downtown renovation"
                                value={projectName}
                                onChangeText={setProjectName}
                            />

                            <Text style={styles.label}>Upload Quote</Text>
                            <Text variant="muted" style={{ marginBottom: theme.spacing[2], fontSize: 13 }}>
                                Take a photo of your estimation/quote. Our AI will analyze it to create tasks.
                            </Text>

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
                                    <Button
                                        variant="outline"
                                        onPress={pickImage}
                                        style={styles.halfButton}
                                    >
                                        <Feather name="image" size={18} style={{ marginRight: 8 }} />
                                        Gallery
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onPress={takePhoto}
                                        style={styles.halfButton}
                                    >
                                        <Feather name="camera" size={18} style={{ marginRight: 8 }} />
                                        Camera
                                    </Button>
                                </View>
                            )}

                            <Button
                                onPress={handleNext}
                                size="lg"
                                style={{ marginTop: theme.spacing[6] }}
                            >
                                Next Step
                            </Button>
                        </CardContent>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50],
    },
    content: {
        padding: theme.spacing[6],
    },
    steps: {
        marginBottom: theme.spacing[6],
    },
    progressBar: {
        height: 6,
        backgroundColor: theme.colors.gray[200],
        borderRadius: 3,
        marginTop: theme.spacing[2],
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        backgroundColor: theme.colors.primary.DEFAULT,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: theme.spacing[2],
        marginTop: theme.spacing[2],
        color: theme.colors.gray[700],
    },
    uploadButtons: {
        flexDirection: 'row',
        gap: theme.spacing[4],
        marginTop: theme.spacing[2],
    },
    halfButton: {
        flex: 1,
    },
    previewContainer: {
        marginTop: theme.spacing[2],
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.gray[200],
    },
    preview: {
        width: '100%',
        height: 200,
        backgroundColor: theme.colors.gray[100],
    },
    clearButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
    }
});
