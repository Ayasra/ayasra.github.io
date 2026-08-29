// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCqGmNcUOmjsariRgX_G-irPiYFPXg3ESw",
  authDomain: "ayasra-website.firebaseapp.com",
  projectId: "ayasra-website",
  storageBucket: "ayasra-website.firebasestorage.app",
  messagingSenderId: "206901338481",
  appId: "1:206901338481:web:b04fba49c60e315fe4d6d0",
  measurementId: "G-JBQ3V73YGE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);