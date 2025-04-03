import axios from "axios";
import crypto from "crypto";
import "dotenv/config";
import { Request, Response } from "express";
import * as functions from "firebase-functions";
import OAuth from "oauth-1.0a";

const oauth = new OAuth({
  consumer: {
    key: process.env.FATSECRET_API_KEY || "",
    secret: process.env.FATSECRET_API_SECRET || "",
  },
  signature_method: "HMAC-SHA1",
  hash_function(baseString: string, key: string) {
    return crypto.createHmac("sha1", key).update(baseString).digest("base64");
  },
});

const FATSECRET_BASE_URL = "https://platform.fatsecret.com/rest/server.api";
const NUTRITIONIX_BASE_URL = "https://trackapi.nutritionix.com/v2";

interface NormalizedFood {
  brand: string;
  food_name: string;
  macros: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  source: string;
  description: string;
  ai_generated: boolean;
  confidence: string;
  image_url?: string | null;

}

// Helper to extract calories from string
const extractCalories = (description: string): number | null => {
  const match = description.match(/(\d+)\s+calories/);
  return match ? parseInt(match[1], 10) : null;
};

const fetchFromFatSecret = async (query: string): Promise<NormalizedFood[]> => {
  const requestData = {
    url: FATSECRET_BASE_URL,
    method: "GET",
    data: {
      method: "foods.search.v4",
      search_expression: query,
      format: "json",
      include_food_images: true, // Include images in the response
    },
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData));

  try {
    const response = await axios.get(requestData.url, {
      params: requestData.data,
      headers: {...authHeader},
    });

    // Check if 'foods' and 'food' properties exist in the response
    if (!response.data.foods || !response.data.foods.food) {
      console.error("Unexpected response structure:", response.data);
      return [];
    }

    return response.data.foods.food.map((item: any): NormalizedFood => ({
      source: "FatSecret",
      brand: item.brand_name || "Generic",
      food_name: item.food_name,
      macros: {
        calories: extractCalories(item.food_description),
        protein: null, // Additional parsing can be implemented
        carbs: null, // Additional parsing can be implemented
        fat: null, // Additional parsing can be implemented
      },
      description: item.food_description,
      ai_generated: false,
      confidence: "medium",
      image_url: item.food_images ? item.food_images[0].url : null,
    }));
  } catch (err) {
    console.error("FatSecret error:", err);
    return [];
  }
};

const fetchFromNutritionix = async (query: string):
    Promise<NormalizedFood[]> => {
  try {
    const response = await axios.get(
      `${NUTRITIONIX_BASE_URL}/search/instant`, {
        params: {query},
        headers: {
          "x-app-id": process.env.NUTRITIONIX_APP_ID || "",
          "x-app-key": process.env.NUTRITIONIX_API_KEY || "",
        },
      });

    return response.data.common.map((item: any): NormalizedFood => ({
      source: "Nutritionix",
      brand: item.brand_name || "Generic",
      food_name: item.food_name,
      macros: {
        calories: item.nf_calories || null,
        protein: item.nf_protein || null,
        carbs: item.nf_total_carbohydrate || null,
        fat: item.nf_total_fat || null,
      },
      description: item.food_name,
      ai_generated: false,
      confidence: "high",
    }));
  } catch (err) {
    console.error("Nutritionix error:", err);
    return [];
  }
};

const normalizeResults = (results: NormalizedFood[]): NormalizedFood[] => {
  return results.map((item: NormalizedFood) => ({
    ...item,
  }));
};

export const getFoodData = functions.https.onRequest(
  async (req: Request, res: Response): Promise<void> => {
    const {query} = req.query;
    if (!query || typeof query !== "string") {
      res.status(400).json({error: "Missing or invalid query"});
      return;
    }

    try {
      const [fatSecretData, nutritionixData] = await Promise.all([
        fetchFromFatSecret(query),
        fetchFromNutritionix(query),
      ]);

      const results = normalizeResults([...fatSecretData, ...nutritionixData]);

      res.json({results});
      return;
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({error: "Something went wrong"});
      return;
    }
  });
