import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Validate environment variables
const requiredEnvVars = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => `REACT_APP_${key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '')}`);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n` +
    `Please create a .env file in the admin-panel directory with these variables.\n` +
    `After creating/updating .env, restart your development server with: npm start`
  );
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY!,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.REACT_APP_FIREBASE_APP_ID!,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
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