import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCXw-32c6j3kclBLubaqsTE4DJgtPPAYlo",
  authDomain: "compost-app-7ed4d.firebaseapp.com",
  databaseURL: "https://compost-app-7ed4d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "compost-app-7ed4d",
  storageBucket: "compost-app-7ed4d.firebasestorage.app",
  messagingSenderId: "724477643042",
  appId: "1:724477643042:web:7a847d604842966e97fd7b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
