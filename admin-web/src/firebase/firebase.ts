import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-TlyMXiRe-ruVxxoNKNC3Ae_KnQ3TzaY",
  authDomain: "mathalino-5f329.firebaseapp.com",
  projectId: "mathalino-5f329",
  storageBucket: "mathalino-5f329.firebasestorage.app",
  messagingSenderId: "700120359963",
  appId: "1:700120359963:web:e21a5aac5ae2cd30a104be",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;