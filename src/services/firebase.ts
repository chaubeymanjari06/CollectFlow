import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA6Ml0TeJsux5XW6LcKvXuIXQzzlPzuMac",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "collectflow-320c4.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "collectflow-320c4",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "collectflow-320c4.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "71414006761",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:71414006761:web:b193aabb80165af78c8178",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-78JVWCDVLV",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://collectflow-320c4-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Singleton initialization
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
