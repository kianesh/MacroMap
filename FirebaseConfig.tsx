
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
//@ts-ignore
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';
import { initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';


const firebaseConfig = {
  apiKey: "AIzaSyDbggEWPkU4yVxjlcoO5_hZ0tVa-MylDD4",
  authDomain: "macro-map-afa5e.firebaseapp.com",
  projectId: "macro-map-afa5e",
  storageBucket: "macro-map-afa5e.firebasestorage.app",
  messagingSenderId: "259054705009",
  appId: "1:259054705009:web:dc70e331e336e58aa9bed0",
  measurementId: "G-KJG4TYRZD8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);