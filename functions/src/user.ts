// user.ts (pls deploy)
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";

export const addUserFood = onRequest(async (req, res) => {
  const {name, calories, protein, carbs, fats} = req.body;
  const db = getFirestore();

  try {
    await db.collection("foods").add({
      name,
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats),
      source: "User",
      timestamp: FieldValue.serverTimestamp(),
    });
    res.status(200).send({success: true});
  } catch (error) {
    console.error("Error adding user food:", error);
    res.status(500).send("Failed to save food entry");
  }
});
