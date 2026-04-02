import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCXw-32c6j3kclBLubaqsTE4DJgtPPAYlo",
  authDomain: "compost-app-7ed4d.firebaseapp.com",
  projectId: "compost-app-7ed4d",
  storageBucket: "compost-app-7ed4d.firebasestorage.app",
  messagingSenderId: "724477643042",
  appId: "1:724477643042:web:7a847d604842966e97fd7b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function loadBatches() {
  return new Promise((resolve) => {
    const dataRef = doc(db, 'compost', 'data');
    onSnapshot(dataRef, (snapshot) => {
      const data = snapshot.data();
      resolve(data?.batches || []);
    });
  });
}

export function subscribeBatches(callback) {
  const dataRef = doc(db, 'compost', 'data');
  return onSnapshot(dataRef, (snapshot) => {
    const data = snapshot.data();
    callback(data?.batches || []);
  });
}

export async function saveBatches(batches, updatedBy) {
  const dataRef = doc(db, 'compost', 'data');
  await setDoc(dataRef, { 
    batches, 
    updatedAt: new Date().toISOString(), 
    updatedBy 
  });
}

export function subscribeUpdatedAt(callback) {
  const dataRef = doc(db, 'compost', 'data');
  return onSnapshot(dataRef, (snapshot) => {
    const data = snapshot.data();
    callback(data ? { updatedAt: data.updatedAt, updatedBy: data.updatedBy } : null);
  });
}
