import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyByXb-FgYHiNhVIsK00kM1jdXYr_OerV7Q",
  authDomain: "karetou-cfd5b.firebaseapp.com",
  projectId: "karetou-cfd5b",
  storageBucket: "karetou-cfd5b.firebasestorage.app",
  messagingSenderId: "40950648608",
  appId: "1:40950648608:web:91b4f1733a28173d2c9145",
  measurementId: "G-D4V96GLYED"
};

// Main app instance for regular authentication
const app = initializeApp(firebaseConfig);

// Separate app instance for admin creation (to avoid session conflicts)
const adminCreationApp = initializeApp(firebaseConfig, 'adminCreation');

export const auth = getAuth(app);
export const adminCreationAuth = getAuth(adminCreationApp);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app; 