import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyAtHexNUUuyg2s_27oYuKT6PY1CHxtu3rE",
  authDomain: "idrisium-forge.firebaseapp.com",
  projectId: "idrisium-forge",
  storageBucket: "idrisium-forge.firebasestorage.app",
  messagingSenderId: "977440894610",
  appId: "1:977440894610:web:0238faef72c61c8eb4404b",
  measurementId: "G-MK2Z13YGJD",
};

function createFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

const app = createFirebaseApp();

let auth: Auth | null = null;
if (typeof window !== "undefined") {
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Failed to set auth persistence", err);
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
