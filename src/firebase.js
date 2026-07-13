import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAzTNIqhnFzCTTIcZtai90UCokJAUfdGNs",
  authDomain: "premix-expenses.firebaseapp.com",
  projectId: "premix-expenses",
  storageBucket: "premix-expenses.firebasestorage.app",
  messagingSenderId: "209565724300",
  appId: "1:209565724300:web:06ab051ccc90e458c295a9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);