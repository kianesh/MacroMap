import {FieldValue, getFirestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions";

interface FoodData {
  name: string;
  calories: number;
  carbs: number;
  fats: number;
  protein: number;
}

export const addUserFood = functions.https.onCall(async (request) => {
  const {data, auth} = request;

  if (!auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated."
    );
  }

  const {name, calories, carbs, fats, protein} = data as FoodData;
  const userId = auth.uid;

  const db = getFirestore();
  const foodData = {
    name,
    calories,
    carbs,
    fats,
    protein,
    source: "user",
    userId,
    timestamp: FieldValue.serverTimestamp(),
  };

  try {
    await db.collection("foods").add(foodData);
    return {success: true};
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error adding food data.");
  }
});
