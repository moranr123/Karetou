import 'dotenv/config';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';

// Firebase configuration using environment variables
// Make sure to create a .env file with your Firebase config
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyByXb-FgYHiNhVIsK00kM1jdXYr_OerV7Q",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "karetou-cfd5b.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "karetou-cfd5b",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "karetou-cfd5b.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "40950648608",
    appId: process.env.FIREBASE_APP_ID || "1:40950648608:web:91b4f1733a28173d2c9145",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-D4V96GLYED"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);