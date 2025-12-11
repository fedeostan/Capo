import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyB3tKiM7ilwwcxeSz_Qhs8ggG8zBELj9ww",
  authDomain: "federico-capo-manager.firebaseapp.com",
  projectId: "federico-capo-manager",
  storageBucket: "federico-capo-manager.firebasestorage.app",
  messagingSenderId: "1068412394516",
  appId: "1:1068412394516:web:d54fa5fcecbc14c31b1b01"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
