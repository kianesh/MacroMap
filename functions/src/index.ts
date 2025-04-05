import axios from "axios";
import crypto from "crypto";
import "dotenv/config";
import {Request, Response} from "express";
import * as functions from "firebase-functions";
import {searchGoogleImagesWithLLM} from "./foodImage";

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
  serving_qty?: number;
  serving_unit?: string;
}

const fetchFromFatSecret = async (query: string): Promise<NormalizedFood[]> => {
  try {
    const method = "GET";
    const params = {
      method: "foods.search",
      search_expression: query,
      format: "json",
      max_results: 50,
      page_number: 0,
    };

    const oauthParams = {
      oauth_consumer_key: process.env.FATSECRET_CLIENT_KEY || "",
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: "1.0",
    };

    const allParams: Record<string, string | number> = {
      ...params, ...oauthParams};
    const paramString = Object.keys(allParams)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(
        allParams[key].toString())}`)
      .join("&");

    const baseString = `${method.toUpperCase()}&${encodeURIComponent(
      FATSECRET_BASE_URL)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(
      process.env.FATSECRET_CLIENT_SECRET || "")}&`;
    const signature = crypto.createHmac(
      "sha1", signingKey).update(baseString).digest("base64");

    const oauthHeaders = {...oauthParams, oauth_signature: signature};

    const response = await axios.get(FATSECRET_BASE_URL, {
      params: {...params, ...oauthHeaders},
    });

    if (!response.data.foods?.food) {
      console.log("No foods found in search for:", query);
      return [];
    }

    const foods = Array.isArray(response.data.foods.food) ?
      response.data.foods.food : [response.data.foods.food];

    const foodPromises = foods.map(async (food: any) => {
      try {
        const detailParams = {
          method: "food.get.v4",
          food_id: food.food_id,
          format: "json",
          include_food_images: true,
        };

        const detailOauthParams = {
          oauth_consumer_key: process.env.FATSECRET_CLIENT_KEY || "",
          oauth_nonce:
           Math.random().toString(36).substring(2) + Date.now().toString(36),
          oauth_signature_method: "HMAC-SHA1",
          oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
          oauth_version: "1.0",
        };

        const detailAllParams: Record<string, string | number | boolean> = {
          ...detailParams,
          ...detailOauthParams,
        };

        const detailParamString = Object.keys(detailAllParams)
          .sort()
          .map((key) => `${encodeURIComponent(key)}=${
            encodeURIComponent(detailAllParams[key].toString())}`)
          .join("&");

        const detailBaseString = `${method.toUpperCase()}&${
          encodeURIComponent(FATSECRET_BASE_URL)}&${
          encodeURIComponent(detailParamString)}`;
        const detailSigningKey = `${
          encodeURIComponent(process.env.FATSECRET_CLIENT_SECRET || "")}&`;
        const detailSignature = crypto.createHmac(
          "sha1", detailSigningKey).update(detailBaseString).digest("base64");

        const detailHeaders = {
          ...detailOauthParams, oauth_signature: detailSignature};

        const detailResponse = await axios.get(FATSECRET_BASE_URL, {
          params: {...detailParams, ...detailHeaders},
        });


        const foodDetail = detailResponse.data.food;

        const servings = foodDetail.servings.serving;
        const primaryServing = Array.isArray(servings) ? servings[0] : servings;

        const imageUrl = foodDetail.images?.image?.[0]?.image_url ||
                         foodDetail.food_images?.food_image?.[0]?.image_url ||
                         null;

        return {
          source: "FatSecret",
          brand: foodDetail.brand_name || "Generic",
          food_name: foodDetail.food_name,
          serving_qty: parseFloat(primaryServing.number_of_units) || 1,
          serving_unit: primaryServing.measurement_description || "serving",
          macros: {
            calories: parseFloat(primaryServing.calories) || 0,
            protein: parseFloat(primaryServing.protein) || 0,
            carbs: parseFloat(primaryServing.carbohydrate) || 0,
            fat: parseFloat(primaryServing.fat) || 0,
          },
          description: foodDetail.food_description || foodDetail.food_name,
          ai_generated: false,
          confidence: "high",
          image_url: imageUrl,
        };
      } catch (detailErr) {
        console.error("Error fetching food details:", detailErr);
        return null;
      }
    });

    const results = await Promise.all(foodPromises);
    return results.filter((item): item is NormalizedFood => item !== null);
  } catch (err) {
    console.error("FatSecret API error:", err);
    return [];
  }
};

const fetchFromNutritionix = async (
  query: string): Promise<NormalizedFood[]> => {
  try {
    const response = await axios.get(`${NUTRITIONIX_BASE_URL}/search/instant`, {
      params: {query},
      headers: {
        "x-app-id": process.env.NUTRITIONIX_APP_ID || "",
        "x-app-key": process.env.NUTRITIONIX_API_KEY || "",
      },
    });

    if (!response.data.common) {
      console.error("Unexpected Nutritionix response:", response.data);
      return [];
    }

    return response.data.common.map((item: any): NormalizedFood => ({
      source: "Nutritionix",
      brand: item.brand_name || "Generic",
      food_name: item.food_name,
      serving_qty: item.serving_qty || 1,
      serving_unit: item.serving_unit || "serving",
      macros: {
        calories: item.nf_calories || 0,
        protein: item.nf_protein || 0,
        carbs: item.nf_total_carbohydrate || 0,
        fat: item.nf_total_fat || 0,
      },
      description: item.food_name,
      ai_generated: false,
      confidence: "high",
      image_url: item.photo?.thumb || null,
    }));
  } catch (err) {
    console.error("Nutritionix error:", err);
    return [];
  }
};

const normalizeResults = (results: NormalizedFood[]): NormalizedFood[] => {
  const uniqueMap = new Map();
  results.forEach((item) => {
    const key = `${item.source}:${item.food_name}`;
    if (!uniqueMap.has(key) || item.confidence === "high") {
      uniqueMap.set(key, item);
    }
  });

  return Array.from(uniqueMap.values()).sort((a, b) => {
    if (a.confidence === b.confidence) {
      const aComplete = Object.values(a.macros).every((val) => val !== null);
      const bComplete = Object.values(b.macros).every((val) => val !== null);
      if (aComplete && !bComplete) return -1;
      if (!aComplete && bComplete) return 1;
      return 0;
    }
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    if (a.confidence === "medium" && b.confidence === "low") return -1;
    return 1;
  });
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

      const needsAiEnhancement = results.some((item) =>
        Object.values(item.macros).some((val) => val === null) ||
        item.confidence !== "high"
      );

      res.json({
        results,
        meta: {
          total: results.length,
          sources: {
            fatsecret: fatSecretData.length,
            nutritionix: nutritionixData.length,
          },
          needsAiEnhancement,
        },
      });
    } catch (err) {
      console.error("Server error:", err);
      res.status(500).json({error: "Something went wrong"});
    }
  }
);

export const findFoodImage = functions.https.onCall(
  async (request: functions.https.CallableRequest) => {
    const query = request.data.query;

    if (!query) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Query is required"
      );
    }

    try {
      // Use the imported function directly
      const imageUrl = await searchGoogleImagesWithLLM(query);
      return {imageUrl};
    } catch (error) {
      console.error("Error finding food image:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to find images"
      );
    }
  }
);
