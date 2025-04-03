import axios from "axios";
import * as crypto from "crypto-js";
import * as dotenv from "dotenv";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
dotenv.config();

// Configuration
const FATSECRET_CONFIG = {
  key: process.env.FATSECRET_CLIENT_KEY || "",
  secret: process.env.FATSECRET_CLIENT_SECRET || "",
  url: "https://platform.fatsecret.com/rest/server.api",
};

const NUTRITIONIX_CONFIG = {
  appId: process.env.NUTRITIONIX_APP_ID || "",
  apiKey: process.env.NUTRITIONIX_API_KEY || "",
  url: "https://trackapi.nutritionix.com/v2/search/instant",
};

interface FoodItem {
  name: string;
  brand?: string;
  image?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  servingSize?: string;
  source: "FatSecret" | "Nutritionix" | "User";
  timestamp: FirebaseFirestore.FieldValue;
}

// Nutritionix API Helper
const fetchNutritionixData = async () => {
  const response = await axios.get(NUTRITIONIX_CONFIG.url, {
    headers: {
      "x-app-id": NUTRITIONIX_CONFIG.appId,
      "x-app-key": NUTRITIONIX_CONFIG.apiKey,
    },
    params: {
      query: "popular",
      detailed: true,
    },
  });

  return response.data.common.map((item: Record<string, any>) => ({
    name: item.food_name,
    brand: item.brand_name,
    image: item.photo.thumb,
    calories: item.nf_calories,
    protein: item.nf_protein,
    carbs: item.nf_total_carbohydrate,
    fats: item.nf_total_fat,
    servingSize: `${item.serving_qty} ${item.serving_unit}`,
    source: "Nutritionix",
  }));
};

// FatSecret API Helper
const fetchFatSecretData = async () => {
  const methodParams = {
    method: "foods.search",
    search_expression: "popular",
    format: "json",
    max_results: "1000",
  };

  const oauthParams = {
    oauth_consumer_key: FATSECRET_CONFIG.key,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const allParams: Record<string, string> = {
    ...methodParams,
    ...oauthParams,
  };

  // Signature generation
  const baseString = [
    "POST",
    encodeURIComponent(FATSECRET_CONFIG.url),
    encodeURIComponent(
      Object.keys(allParams)
        .sort()
        .map((key) => `${encodeURIComponent(key)}=${
          encodeURIComponent(allParams[key])}`)
        .join("&")
    ),
  ].join("&");

  const signingKey = `${encodeURIComponent(FATSECRET_CONFIG.secret)}&`;
  // eslint-disable-next-line new-cap
  const signature = crypto.HmacSHA1(baseString, signingKey)
    .toString(crypto.enc.Base64);

  const finalParams = {...allParams, oauth_signature: signature};

  const response = await axios.post(
    FATSECRET_CONFIG.url,
    null,
    {
      params: finalParams,
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
    }
  );

  const foods = response.data.foods?.food;
  if (!foods) throw new Error("No food data found");

  return (Array.isArray(foods) ? foods : [foods])
    .map((item: Record<string, any>) => {
      const nutrition = item.food_description.match(
        // eslint-disable-next-line max-len
        /Calories:\s*([\d.]+)\s*kcal.*Fat:\s*([\d.]+)g.*Carbs:\s*([\d.]+)g.*Protein:\s*([\d.]+)g/i
      ) || [];

      return {
        name: item.food_name,
        brand: item.brand_name || (item.food_type === "Brand" ?
          item.food_type : "Generic"),
        calories: parseFloat(nutrition[1]) || 0,
        protein: parseFloat(nutrition[4]) || 0,
        carbs: parseFloat(nutrition[3]) || 0,
        fats: parseFloat(nutrition[2]) || 0,
        servingSize: "100g",
        source: "FatSecret",
      };
    })
    .filter((item) => item.calories > 0);
};

// Main Function
export const updateFoodsDatabase = onRequest(async (req, res) => {
  const db = getFirestore();
  const batch = db.batch();
  const foodsCollection = db.collection("foods");

  try {
    const [nutritionixData, fatSecretData] = await Promise.all([
      fetchNutritionixData(),
      fetchFatSecretData(),
    ]);

    const allFoods: FoodItem[] = [
      ...nutritionixData,
      ...fatSecretData,
    ].map((item) => ({
      ...item,
      timestamp: FieldValue.serverTimestamp(),
    }));

    allFoods.forEach((food) => {
      batch.set(foodsCollection.doc(), food);
    });

    await batch.commit();
    res.status(200).send(`Added ${allFoods.length} items`);
  } catch (error) {
    console.error("Update failed:", error);
    res.status(500).send("Update failed");
  }
});
