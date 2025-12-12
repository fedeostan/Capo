import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { theme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Text } from '../../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

// Simple Dropdown implementation since we don't have a component library
// Actually user environment probably doesn't have picker installed.
// I will implement a simple selection using buttons or a modal for "Role".
// Given constraints, I'll use a simple list of TouchableOpacity as options or standard Buttons.

const ROLES = [
    { label: "General Contractor", value: "general_contractor" },
    { label: "Project Manager", value: "project_manager" },
    { label: "Architect / Engineer", value: "architect" },
    { label: "Subcontractor", value: "subcontractor" },
    { label: "Client / Owner", value: "client" }
];

export default function OnboardingProfileScreen({ navigation }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [role, setRole] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNext = async () => {
        if (!firstName || !lastName || !role) {
            Alert.alert("Missing Information", "Please fill in all fields including your role.");
            return;
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("No user found");

            // Update Auth Profile
            await updateProfile(user, { displayName: `${firstName} ${lastName}` });

            // Update Firestore Profile
            await updateDoc(doc(db, "users", user.uid), {
                firstName,
                lastName,
                role,
                updatedAt: new Date()
            });

            navigation.navigate('ProjectSetup');

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.steps}>
                        <Text variant="small" style={{ color: theme.colors.primary.DEFAULT, fontWeight: 'bold' }}>STEP 1 OF 3</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: '33%' }]} />
                        </View>
                    </View>

                    <Card>
                        <CardHeader>
                            <CardTitle>Tell us about yourself</CardTitle>
                            <CardDescription>We need a few details to customize your experience.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Input
                                label="First Name"
                                placeholder="e.g. John"
                                value={firstName}
                                onChangeText={setFirstName}
                            />
                            <Input
                                label="Last Name"
                                placeholder="e.g. Doe"
                                value={lastName}
                                onChangeText={setLastName}
                            />

                            <Text style={styles.label}>What is your role?</Text>
                            <View style={styles.roleContainer}>
                                {ROLES.map((r) => (
                                    <Button
                                        key={r.value}
                                        variant={role === r.value ? "default" : "outline"}
                                        size="sm"
                                        onPress={() => setRole(r.value)}
                                        style={styles.roleButton}
                                    >
                                        {r.label}
                                    </Button>
                                ))}
                            </View>

                            <Button
                                onPress={handleNext}
                                loading={loading}
                                size="lg"
                                style={{ marginTop: theme.spacing[6] }}
                            >
                                Continue
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
    roleContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing[2],
        marginTop: theme.spacing[2],
    },
    roleButton: {
        marginBottom: theme.spacing[2],
        marginRight: theme.spacing[2],
    }
});
