// index.ts (deploy pls)
import {initializeApp} from "firebase-admin/app";
import {updateFoodsDatabase} from "./api";
import {addUserFood} from "./user";

initializeApp();

export {addUserFood, updateFoodsDatabase};

