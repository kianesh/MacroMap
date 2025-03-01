// api.ts (pls deploy)
import axios from "axios";
import * as crypto from "crypto-js";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";

// Configuration
const FATSECRET_CONFIG = {
  key: "2e3df77a4d7a4481a05a9d79152e64ad",
  secret: "8591547e4ea24556a46a8005398fb5ba",
  url: "https://platform.fatsecret.com/rest/server.api",
};

const NUTRITIONIX_CONFIG = {
  appId: "2669dd01",
  apiKey: "1eca61bb2a7f7d680862d6fd3355fc52",
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

// FatSecret OAuth Helper
const generateFatSecretSignature = (
  method: string,
  params: Record<string, string | number>
) => {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: FATSECRET_CONFIG.key,
    oauth_nonce: Math.random().toString(36).substring(2),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };

  const allParams: Record<string, string> = {
    ...Object.entries(params).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: String(value),
    }), {}),
    ...oauthParams,
  };

  const paramString = Object.keys(allParams)
    .sort()
    .map((key) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`
    )
    .join("&");

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(FATSECRET_CONFIG.url),
    encodeURIComponent(paramString),
  ].join("&");

  const signingKey = `${encodeURIComponent(FATSECRET_CONFIG.secret)}&`;
  // eslint-disable-next-line new-cap
  return crypto.HmacSHA1(baseString, signingKey).toString(crypto.enc.Base64);
};

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
  const params = {
    method: "foods.get.v4",
    search_expression: "popular",
    format: "json",
    max_results: 50,
  };

  const signature = generateFatSecretSignature("GET", params);

  const response = await axios.get(FATSECRET_CONFIG.url, {
    params: {
      ...params,
      oauth_signature: signature,
    },
  });

  // Log the response to understand its structure
  console.log("FatSecret API Response:", response.data);

  // Safely access the food array
  const foods = response.data.foods?.food;
  if (!foods) {
    throw new Error("No food data found in the response");
  }

  const foodArray = Array.isArray(foods) ? foods : [foods];

  return foodArray.map((item: Record<string, any>) => ({
    name: item.food_name,
    brand: item.brand_name,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbohydrate,
    fats: item.fat,
    source: "FatSecret",
  }));
};

// Main Scheduled Function
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
      const ref = foodsCollection.doc();
      batch.set(ref, food);
    });

    await batch.commit();
    console.log(`Successfully added ${allFoods.length} food items`);
    res.status(200).send(`Successfully added ${allFoods.length} food items`);
  } catch (error) {
    console.error("Failed to update food database:", error);
    res.status(500).send("Failed to update food database");
  }
});
