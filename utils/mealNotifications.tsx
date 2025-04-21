import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

// Access environment variables
const {
  GOOGLE_MAPS_API_KEY,
  FATSECRET_CLIENT_KEY,
  FATSECRET_CLIENT_SECRET
} = Constants.expoConfig?.extra || {};

const BACKGROUND_NEARBY_MEALS_TASK = 'BACKGROUND_NEARBY_MEALS_TASK';
const BACKGROUND_FETCH_TASK = 'BACKGROUND_FETCH_TASK';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Define the background task for location updates
TaskManager.defineTask(BACKGROUND_NEARBY_MEALS_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Location Background Task Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      await checkForMacroFriendlyRestaurants(location.coords);
    }
  }
});

// Define background fetch task for periodic checks
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    await checkForMacroFriendlyRestaurants(location.coords);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Function to check for macro-friendly restaurants nearby
async function checkForMacroFriendlyRestaurants(coords: { latitude: number, longitude: number }) {
  try {
    // Get user preferences for notifications
    const notificationsEnabled = await AsyncStorage.getItem('notificationsEnabled');
    if (notificationsEnabled !== 'true') return;
    
    // Get diet preferences
    const dietPreference = await AsyncStorage.getItem('dietPreference') || 'balanced';
    
    // Skip if we've sent notifications recently (throttle)
    const lastNotificationTime = await AsyncStorage.getItem('lastMealNotificationTime');
    if (lastNotificationTime) {
      const timeSinceLastNotification = Date.now() - parseInt(lastNotificationTime, 10);
      if (timeSinceLastNotification < 3600000) { // 1 hour
        return;
      }
    }
    
    // Find nearby restaurants
    const restaurants = await findNearbyRestaurants(coords);
    
    // Find a suitable restaurant based on diet preference
    const restaurant = findMacroFriendlyRestaurant(restaurants, dietPreference);
    
    if (restaurant) {
      // Schedule a notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Macro-Friendly Meal Nearby',
          body: `${restaurant.name} is nearby and has food that fits your macros!`,
          data: { restaurant },
        },
        trigger: null, // Send immediately
      });
      
      // Update last notification time
      await AsyncStorage.setItem('lastMealNotificationTime', Date.now().toString());
    }
  } catch (error) {
    console.error('Error checking for macro-friendly restaurants:', error);
  }
}

// Find nearby restaurants
async function findNearbyRestaurants(coords: { latitude: number, longitude: number }) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          location: `${coords.latitude},${coords.longitude}`,
          radius: 1000, // 1km radius
          type: 'restaurant',
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );
    
    return response.data.results || [];
  } catch (error) {
    console.error('Error finding nearby restaurants:', error);
    return [];
  }
}

// Find a restaurant that matches diet preference
function findMacroFriendlyRestaurant(restaurants: any[], dietPreference: string) {
  // Define keywords for different diet preferences
  const dietKeywords: Record<string, string[]> = {
    balanced: ['healthy', 'balance', 'fresh', 'nutritious', 'wholesome'],
    lowCarb: ['keto', 'low carb', 'protein', 'paleo', 'atkins'],
    highProtein: ['protein', 'fitness', 'gym', 'athletic', 'bodybuilding'],
    vegetarian: ['vegetarian', 'plant', 'veggie', 'meatless', 'green'],
    vegan: ['vegan', 'plant-based', 'dairy-free', 'meatless'],
  };
  
  const keywords = dietKeywords[dietPreference] || dietKeywords.balanced;
  
  // Filter restaurants by name or type containing relevant keywords
  const matchingRestaurants = restaurants.filter(restaurant => {
    const name = restaurant.name.toLowerCase();
    const types = restaurant.types || [];
    
    return keywords.some(keyword => 
      name.includes(keyword) || 
      types.some((type: string) => type.includes(keyword))
    );
  });
  
  // Return a random matching restaurant or first available
  return matchingRestaurants.length > 0 
    ? matchingRestaurants[Math.floor(Math.random() * matchingRestaurants.length)]
    : null;
}

// Start background location tracking
export async function startLocationTracking() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  
  if (status === 'granted') {
    await Location.requestBackgroundPermissionsAsync();
    
    // Register background fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 900, // 15 minutes (in seconds)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    // Start location updates
    await Location.startLocationUpdatesAsync(BACKGROUND_NEARBY_MEALS_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 900000, // 15 minutes (in ms)
      distanceInterval: 500, // 500 meters
      foregroundService: {
        notificationTitle: "Macro Map",
        notificationBody: "Finding macro-friendly meals near you",
      },
    });
    
    // Store preference
    await AsyncStorage.setItem('notificationsEnabled', 'true');
  }
}

// Stop background location tracking
export async function stopLocationTracking() {
  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_NEARBY_MEALS_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_NEARBY_MEALS_TASK);
  }
  
  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK)) {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  }
  
  await AsyncStorage.setItem('notificationsEnabled', 'false');
}

// Toggle notifications setting
export async function toggleMealNotifications(enabled: boolean) {
  if (enabled) {
    await startLocationTracking();
  } else {
    await stopLocationTracking();
  }
  
  return enabled;
}

// Check if notifications are enabled
export async function areMealNotificationsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem('notificationsEnabled')) === 'true';
}

// Set diet preference
export async function setDietPreference(preference: string) {
  await AsyncStorage.setItem('dietPreference', preference);
}

// Get current diet preference
export async function getDietPreference(): Promise<string> {
  return (await AsyncStorage.getItem('dietPreference')) || 'balanced';
}