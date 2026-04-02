import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue } from 'firebase/database';

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
const db = getDatabase(app);

export async function loadBatches() {
  return new Promise((resolve) => {
    const dataRef = ref(db, 'compost/batches');
    onValue(dataRef, (snapshot) => {
      resolve(snapshot.val() || []);
    }, { onlyOnce: true });
  });
}

export function subscribeBatches(callback) {
  const dataRef = ref(db, 'compost/batches');
  return onValue(dataRef, (snapshot) => {
    callback(snapshot.val() || []);
  });
}

export async function saveBatches(batches, updatedBy) {
  const dataRef = ref(db, 'compost/batches');
  await set(dataRef, batches);
  const metaRef = ref(db, 'compost/meta');
  await set(metaRef, { updatedAt: new Date().toISOString(), updatedBy });
}

export function subscribeUpdatedAt(callback) {
  const metaRef = ref(db, 'compost/meta');
  return onValue(metaRef, (snapshot) => {
    callback(snapshot.val());
  });
}
