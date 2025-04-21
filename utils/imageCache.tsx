import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

const CACHE_KEY_PREFIX = 'food_image_cache_';
const CACHE_EXPIRY_DAYS = 30; // Cache food images for 30 days

interface CacheEntry {
  imageUrl: string;
  timestamp: number;
}

export async function getCachedImageUrl(foodName: string, brandName?: string): Promise<string | null> {
  try {
    const key = generateCacheKey(foodName, brandName);
    const cached = await AsyncStorage.getItem(key);
    
    if (cached) {
      const entry: CacheEntry = JSON.parse(cached);
      const now = Date.now();
      const expiry = entry.timestamp + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      
      // Return cached image if it's still valid
      if (now < expiry) {
        return entry.imageUrl;
      }
      
      // Remove expired entry
      await AsyncStorage.removeItem(key);
    }
    
    return null;
  } catch (error) {
    console.error('Error accessing image cache:', error);
    return null;
  }
}

// Add this new function to prefetch images
export async function prefetchImage(url: string): Promise<boolean> {
  if (!url) return false;
  
  try {
    // Use React Native's image prefetching for faster loading
    await Image.prefetch(url);
    return true;
  } catch (error) {
    console.error('Error prefetching image:', error);
    return false;
  }
}

// Update the existing cacheImageUrl function to also prefetch
export async function cacheImageUrl(foodName: string, brandName: string | undefined, imageUrl: string): Promise<void> {
  try {
    const key = generateCacheKey(foodName, brandName);
    const entry: CacheEntry = {
      imageUrl,
      timestamp: Date.now()
    };
    
    await AsyncStorage.setItem(key, JSON.stringify(entry));
    
    // Prefetch the image for better performance
    prefetchImage(imageUrl);
  } catch (error) {
    console.error('Error caching image URL:', error);
  }
}

function generateCacheKey(foodName: string, brandName?: string): string {
  const normalizedFoodName = foodName.toLowerCase().trim();
  const normalizedBrandName = brandName ? brandName.toLowerCase().trim() : '';
  return `${CACHE_KEY_PREFIX}${normalizedBrandName}_${normalizedFoodName}`;
}