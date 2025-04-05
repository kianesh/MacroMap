// Enhanced Cloud Function with LLM for image selection
import axios from "axios";
import {OpenAI} from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Modified function to use LLM for image selection
/**
 * Uses Google image search and OpenAI LLM to find the best image for a food
 * @param {string} query The food item to search for
 * @return {Promise<string|null>} URL of the best image or null if none found
 */
export async function searchGoogleImagesWithLLM(query: string):
 Promise<string | null> {
  try {
    // First get multiple image results
    const response =
    await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: process.env.GOOGLE_SEARCH_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query + " food photo",
        searchType: "image",
        num: 5, // Get 5 images for LLM to choose from
        imgSize: "medium",
        safe: "active",
      },
    });

    if (!response.data.items || response.data.items.length === 0) {
      return null;
    }

    // Extract images and their metadata
    interface ImageItem {
      link: string;
      title?: string;
      snippet?: string;
      image: {
        contextLink: string;
      };
    }

    const images = (response.data.items as ImageItem[]).map((item) => ({
      url: item.link,
      title: item.title || "",
      snippet: item.snippet || "",
      contextLink: item.image.contextLink || "",
    }));

    // Use LLM to select the best image
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert food photographer assistant." +
           "Your task is to select the most appetizing and accurate image for" +
           " a specific food item.",
        },
        {
          role: "user",
          content: `I'm looking for the best image of "${query}". Please" +
          analyze these images and select the BEST ONE based on:
          1. Visual appeal (appetizing, well-lit, professional quality)
          2. Accuracy (most closely matches the food item)
          3. Clear presentation (food is clearly visible, not obscured)
          4. Neutral background (professional food photography style)
          
          Here are the candidate images:
          ${JSON.stringify(images)}
          Return ONLY the URL of the best image in this exact format:" 
          "BEST_IMAGE_URL: [url]"`,
        },
      ],
    });

    const result = completion.choices[0]?.message?.content;
    if (result) {
      const match = result.match(/BEST_IMAGE_URL: (https?:\/\/[^\s"]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Fallback to first image if LLM selection fails
    return images[0].url;
  } catch (error) {
    console.error("Error using LLM for image selection:", error);
    return null;
  }
}
