import { initializeApp } from 'firebase/app';
import { config } from 'dotenv';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';
k

const firebaseApp initializeApp({
  apiKey: "AIzaSyCk1c7S1-SRayX5x402qRt6Kmv1eXTkhJI",
  authDomain: "alpha-note-274ac.firebaseapp.com",
  projectId: "alpha-note-274ac",
  storageBucket: "alpha-note-274ac.appspot.com",
  messagingSenderId: "683733177535",
  appId: "1:683733177535:web: 3a3312c51ab980863ce20a",
  measurementId: "G-TV6C3016HT"
});

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);


auth.onAuthStateChanged(user => {
  if (user) {
    console.log('Você entrou! Prepare seu chá ou seu café:', user);
  } else {
    console.log('Nenhum usuário logado');
  }
})
