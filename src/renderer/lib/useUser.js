import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";

import { atom, useRecoilState, useRecoilValue } from "recoil";

import { app, auth } from "./firebaseConfig";

const userState = atom({
  key: "user",
  default: {
    loading: true,
    value: null,
  },
  effects: [
    ({ setSelf }) => {
      return onAuthStateChanged(auth, (user) => {
        setSelf({ loading: false, value: JSON.parse(JSON.stringify(user)) });
      });
    },
  ],
});

const signIn = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

const registerUser = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

const signOut = () => auth.signOut();

export default function useUser() {
  const { value, loading } = useRecoilValue(userState);

  return {
    user: value,
    loading,
    signIn,
    registerUser,
    signOut,
  };
}
