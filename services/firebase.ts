import { initializeApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

// Define types for environment variables
interface ImportMetaEnv {
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_PROJECT_ID: string;
  VITE_FIREBASE_STORAGE_BUCKET: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  VITE_FIREBASE_APP_ID: string;
}

// Safely access env variables using type assertion to handle missing vite/client types
const env = (import.meta as unknown as { env: ImportMetaEnv }).env || {
  VITE_FIREBASE_API_KEY: "",
  VITE_FIREBASE_AUTH_DOMAIN: "",
  VITE_FIREBASE_PROJECT_ID: "",
  VITE_FIREBASE_STORAGE_BUCKET: "",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "",
  VITE_FIREBASE_APP_ID: ""
};

// Konfigurace se načte z proměnných prostředí
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// Check if critical config is present
const isConfigured = !!env.VITE_FIREBASE_API_KEY && !!env.VITE_FIREBASE_PROJECT_ID;

let app;
let dbInstance: Firestore | null = null;

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase, falling back to local storage.", e);
  }
} else {
  console.log("Firebase config missing. Running in Local Storage mode.");
}

export const db = dbInstance;