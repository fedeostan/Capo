import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { theme } from '../../theme';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import ProjectProcessingOverlay from '../../components/ProjectProcessingOverlay';

export default function OnboardingProcessingScreen({ navigation, route }) {
    const { projectName, quoteUri, startDate, deadline, durationWeeks } = route.params;
    const [isVisible, setIsVisible] = useState(true);

    const handleComplete = async (projectId) => {
        setIsVisible(false);
        try {
            // Mark onboarding as complete
            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, {
                onboardingCompleted: true
            });
            // Navigate to Dashboard
            navigation.reset({
                index: 0,
                routes: [{ name: 'Dashboard' }],
            });
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Could not finalize onboarding.");
            navigation.reset({
                index: 0,
                routes: [{ name: 'Dashboard' }],
            });
        }
    };

    const handleError = (msg) => {
        // Overlay handles showing the error, but if they close it:
        setIsVisible(false);
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <ProjectProcessingOverlay
                isVisible={isVisible}
                projectData={{
                    projectName,
                    quoteUri,
                    startDate,
                    deadline,
                    durationWeeks
                }}
                onComplete={handleComplete}
                onError={handleError}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.gray[50],
    },
});
