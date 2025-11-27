// PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
const firebaseConfig = {
   apiKey: "AIzaSyB8SJNqL7A0vsBrsByyuDroM72tyZdmSJ8",
  authDomain: "moneydude-f41e6.firebaseapp.com",
  projectId: "moneydude-f41e6",
  storageBucket: "moneydude-f41e6.firebasestorage.app",
  messagingSenderId: "637243581003",
  appId: "1:637243581003:web:a06120126a90074b7fa3ce"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();