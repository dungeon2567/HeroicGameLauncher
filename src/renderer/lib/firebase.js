import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserPopupRedirectResolver,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

/*
const config = {
  apiKey: "AIzaSyBuiFvktbOLaKdG5vybHcVX96bpgGKDM_U",
  authDomain: "worldsembrace-227ca.firebaseapp.com",
  projectId: "worldsembrace-227ca",
  storageBucket: "worldsembrace-227ca.appspot.com",
  messagingSenderId: "528256274255",
  appId: "1:528256274255:web:1e3527d431e1e661c27f3a",
  measurementId: "G-JCQ71Z1HPB",
};
*/

const config = {
  apiKey: "AIzaSyBSKkVynZI6V2A7LDZIupxvWM6--bsFi2s",
  authDomain: "zomfi-6d55d.firebaseapp.com",
  projectId: "zomfi-6d55d",
  storageBucket: "zomfi-6d55d.appspot.com",
  messagingSenderId: "419141355706",
  appId: "1:419141355706:web:e518660468460173021a83",
  measurementId: "G-S85N5MW8S7",
};

const app = initializeApp(config);

const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export { app, auth };
