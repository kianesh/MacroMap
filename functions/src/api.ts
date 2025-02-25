import axios from "axios";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";

const API_KEY = "your_nutrition_api_key";
const API_URL = "https://api.nutrition.com/v1/foods";

export const updateFoodsDatabase = onSchedule(
  {schedule: "0 0 1 * *", timeZone: "UTC"},
  async () => {
    try {
      const response = await axios.get(API_URL, {
        params: {api_key: API_KEY},
      });
      const foods = response.data;

      const db = getFirestore();
      const batch = db.batch();
      const foodsCollection = db.collection("foods");

      foods.forEach((food: {
        name: string;
        calories: number;
        carbs: number;
        fats: number;
        protein: number;
      }) => {
        const foodRef = foodsCollection.doc();
        batch.set(foodRef, {
          name: food.name,
          calories: food.calories,
          carbs: food.carbs,
          fats: food.fats,
          protein: food.protein,
          source: "API",
          timestamp: FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log("Foods database updated successfully.");
    } catch (error) {
      console.error("Error updating foods database:", error);
    }
  }
);
