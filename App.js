import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { LogBox } from 'react-native';
import { navTheme } from './theme';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Screens
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import ProjectSettingsScreen from './screens/ProjectSettingsScreen';
import UploadQuoteScreen from './screens/UploadQuoteScreen';

// Onboarding Screens
import OnboardingProfileScreen from './screens/onboarding/OnboardingProfileScreen';
import OnboardingProjectSetupScreen from './screens/onboarding/OnboardingProjectSetupScreen';
import OnboardingTimelineScreen from './screens/onboarding/OnboardingTimelineScreen';
import OnboardingProcessingScreen from './screens/onboarding/OnboardingProcessingScreen';
import ProjectCreateModal from './screens/ProjectCreateModal';

// Ignore some Expo warnings for smoother demo
LogBox.ignoreAllLogs();

const Stack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const ProjectCreationStack = createNativeStackNavigator();


function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
      <OnboardingStack.Screen name="ProjectSetup" component={OnboardingProjectSetupScreen} initialParams={{ isOnboarding: true }} />
      <OnboardingStack.Screen name="ProjectTimeline" component={OnboardingTimelineScreen} initialParams={{ isOnboarding: true }} />
      <OnboardingStack.Screen name="ProjectProcessing" component={OnboardingProcessingScreen} initialParams={{ isOnboarding: true }} />
    </OnboardingStack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists() && userDoc.data().onboardingCompleted) {
            setOnboardingCompleted(true);
          } else {
            setOnboardingCompleted(false);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setOnboardingCompleted(false);
        }
      } else {
        setOnboardingCompleted(false);
      }
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
  }, []);

  if (initializing) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            onboardingCompleted ? (
              <>
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
                <Stack.Screen name="ProjectSettings" component={ProjectSettingsScreen} />
                <Stack.Screen name="UploadQuote" component={UploadQuoteScreen} />
                <Stack.Screen name="ProjectProcessing" component={OnboardingProcessingScreen} initialParams={{ isOnboarding: false }} />
                <Stack.Group screenOptions={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }}>
                  <Stack.Screen name="ProjectCreateModal" component={ProjectCreateModal} />
                </Stack.Group>
              </>
            ) : (
              <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
            )
          ) : (
            <Stack.Screen name="Auth" component={AuthScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
