import {initializeApp} from "firebase-admin/app";
import {updateFoodsDatabase} from "./api";
import {addUserFood} from "./user";

// Initialize Firebase Admin once here
initializeApp();

export {addUserFood, updateFoodsDatabase};
