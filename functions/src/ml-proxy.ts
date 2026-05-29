import axios from "axios";
import "dotenv/config";
import * as functions from "firebase-functions";

const ML_API_URL = process.env.ML_API_URL || "";
const ML_API_SECRET = process.env.ML_API_SECRET || "";

const VALID_METRICS = ["calories", "protein", "carbs", "fats", "weight"];

/**
 * Proxies a forecast request to the Python ML service.
 *
 * The React Native client calls this callable with Firebase Auth; the
 * authenticated uid is forwarded server-side so the client never holds the
 * ML service bearer token. Only the metric is taken from the client.
 */
export const forecastNutrition = functions.https.onCall(
  async (request: functions.https.CallableRequest) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to view trends."
      );
    }

    const metric = request.data?.metric;
    if (typeof metric !== "string" || !VALID_METRICS.includes(metric)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "metric must be one of: " + VALID_METRICS.join(", ")
      );
    }

    if (!ML_API_URL || !ML_API_SECRET) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "ML service is not configured."
      );
    }

    try {
      const response = await axios.post(
        `${ML_API_URL}/forecast-nutrition`,
        {user_id: uid, metric},
        {
          headers: {
            "Authorization": `Bearer ${ML_API_SECRET}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );
      return response.data;
    } catch (err) {
      console.error("forecastNutrition proxy error:", err);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to generate forecast."
      );
    }
  }
);
