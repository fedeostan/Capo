import React, { useState } from 'react';
import { View, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { setDoc, doc } from 'firebase/firestore';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Text } from '../components/ui/Text';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';

export default function AuthScreen({ navigation }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await setDoc(doc(db, "users", user.uid), {
                    email: email,
                    createdAt: new Date(),
                    onboardingCompleted: false
                });
            }
        } catch (error) {
            Alert.alert('Authentication Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.headerContainer}>
                        <View style={styles.logoPlaceholder}>
                            {/* Replace with actual logo if available */}
                            <Text variant="h3" color={theme.colors.primary.DEFAULT} align="center">Capo</Text>
                        </View>
                    </View>

                    <Card>
                        <CardHeader>
                            <CardTitle align="center">
                                {isLogin ? 'Welcome Back' : 'Create an Account'}
                            </CardTitle>
                            <CardDescription align="center">
                                {isLogin ? 'Enter your credentials to access your dashboard' : 'Enter your details to get started'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>

                            <Input
                                placeholder="name@example.com"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                            <Input
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />

                            <Button
                                onPress={handleAuth}
                                loading={loading}
                                size="lg"
                                style={styles.submitButton}
                            >
                                {isLogin ? 'Sign In' : 'Sign Up'}
                            </Button>
                        </CardContent>
                        <CardFooter style={{ justifyContent: 'center' }}>
                            <Button
                                variant="link"
                                onPress={() => setIsLogin(!isLogin)}
                            >
                                {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </Button>
                        </CardFooter>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50], // Light gray background
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: theme.spacing[6],
    },
    headerContainer: {
        marginBottom: theme.spacing[8],
        alignItems: 'center',
    },
    logoPlaceholder: {
        width: 80,
        height: 80,
        backgroundColor: theme.colors.primary.light,
        borderRadius: theme.radius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing[4],
    },
    submitButton: {
        marginTop: theme.spacing[2],
    }
});
