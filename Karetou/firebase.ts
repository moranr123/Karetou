import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';


// Your Firebase configuration
// Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyByXb-FgYHiNhVIsK00kM1jdXYr_OerV7Q",
    authDomain: "karetou-cfd5b.firebaseapp.com",
    projectId: "karetou-cfd5b",
    storageBucket: "karetou-cfd5b.firebasestorage.app",
    messagingSenderId: "40950648608",
    appId: "1:40950648608:web:91b4f1733a28173d2c9145",
    measurementId: "G-D4V96GLYED"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);