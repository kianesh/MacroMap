import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useFonts } from 'expo-font';
import * as Location from 'expo-location';
import * as SplashScreen from 'expo-splash-screen';
import { addDoc, collection } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../FirebaseConfig';
// Conditionally import MapView
let MapView: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}


import {
  FATSECRET_CLIENT_KEY,
  FATSECRET_CLIENT_SECRET,
  GOOGLE_MAPS_API_KEY,
} from 'react-native-dotenv';

const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';

SplashScreen.preventAutoHideAsync();

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface Restaurant {
  place_id: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name: string;
  vicinity: string;
}

interface NutritionInfo {
  food_name: string;
  brand_name?: string;
  serving_qty: number;
  serving_unit: string;
  nf_calories: number;
  nf_total_fat: number;
  nf_protein: number;
  nf_total_carbohydrate: number;
  image_url?: string;
}

export default function MapScreen() {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState<string>('');
  const [foodResults, setFoodResults] = useState<NutritionInfo[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loaded, error] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
    })();
  }, [loaded, error]);

  const generateOAuthSignature = (method: string, url: string, params: any) => {
    const oauthParams = {
      oauth_consumer_key: FATSECRET_CLIENT_KEY,
      oauth_nonce: Math.random().toString(36).substring(2),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0'
    };

    const allParams = { ...params, ...oauthParams };
    const paramString = Object.keys(allParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(allParams[key])}`)
      .join('&');

    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(FATSECRET_CLIENT_SECRET)}&`;
    const signature = CryptoJS.HmacSHA1(baseString, signingKey).toString(CryptoJS.enc.Base64);

    return {
      ...oauthParams,
      oauth_signature: signature
    };
  };

  const fetchNearbyRestaurants = async (searchQuery: string) => {
    if (!location) return;
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&location=${location.latitude},${location.longitude}&radius=1500&key=${GOOGLE_MAPS_API_KEY}`
      );
      setRestaurants(response.data.results);
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
    }
  };

  const searchFoods = async (restaurantName: string) => {
    if (!restaurantName.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      const method = 'GET';
      const params = {
        method: 'foods.search',
        search_expression: restaurantName,
        format: 'json',
        max_results: 50,
        page_number: 0,
      };

      const oauthHeaders = generateOAuthSignature(method, FATSECRET_API_URL, params);

      const response = await axios.get(FATSECRET_API_URL, {
        params: {
          ...params,
          ...oauthHeaders,
        },
      });

      const foods = response.data.foods?.food || [];
      const foodDetails = Array.isArray(foods)
        ? foods.map((food: any) => ({
            food_name: food.food_name || 'Unknown Food',
            brand_name: food.brand_name || '',
            serving_qty: parseFloat(food.serving_qty) || 1,
            serving_unit: food.serving_unit || 'serving',
            nf_calories: parseFloat(food.nf_calories) || 0,
            nf_protein: parseFloat(food.nf_protein) || 0,
            nf_total_fat: parseFloat(food.nf_total_fat) || 0,
            nf_total_carbohydrate: parseFloat(food.nf_total_carbohydrate) || 0,
            image_url: food.food_images?.food_image?.[0]?.image_url || null,
          }))
        : [];

      setFoodResults(foodDetails);
    } catch (error) {
      console.error('Error searching foods:', error);
      alert('Failed to search for foods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logMeal = async (meal: NutritionInfo) => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in to log meals');
      return;
    }

    try {
      await addDoc(collection(db, 'meals'), {
        userId: user.uid,
        name: meal.food_name,
        brand_name: meal.brand_name || 'N/A',
        protein: Number(meal.nf_protein) || 0,
        fats: Number(meal.nf_total_fat) || 0,
        carbs: Number(meal.nf_total_carbohydrate) || 0,
        calories: Number(meal.nf_calories) || 0,
        timestamp: new Date(),
      });
      alert('Meal logged successfully!');
    } catch (error) {
      console.error('Error logging meal:', error);
      alert('Failed to log meal. Please try again.');
    }
  };

  const handleSearch = async () => {
    if (!query) return;
    await fetchNearbyRestaurants(query);
    setSelectedRestaurant(query);
    await searchFoods(query);
  };

  const handleMarkerPress = async (restaurantName: string) => {
    setSelectedRestaurant(restaurantName);
    await searchFoods(restaurantName);
  };

  const handleMapPress = () => {
    setSelectedRestaurant(null);
    setFoodResults([]);
  };

  const renderPopup = () => (
    <View style={styles.popup}>
      <Text style={styles.popupTitle}>{selectedRestaurant}</Text>
      <ScrollView>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : foodResults.length > 0 ? (
          foodResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              {result.image_url ? (
                <Image 
                  source={{ uri: result.image_url }} 
                  style={styles.foodImage}
                  resizeMode="cover"
                  onError={() => console.log('Error loading image')}
                />
              ) : (
                <View style={[styles.foodImage, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              <View style={styles.resultContent}>
                <Text style={styles.resultName}>{result.food_name}</Text>
                <Text style={styles.resultCalories}>{result.nf_calories} Cal</Text>
                <Text style={styles.resultMacros}>
                  P: {result.nf_protein}g • F: {result.nf_total_fat}g • C: {result.nf_total_carbohydrate}g
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={styles.addButton} 
                    onPress={() => logMeal(result)}
                  >
                    <Text style={styles.addButtonText}>Add Food</Text>
                  </TouchableOpacity>
                  <View style={styles.deliveryButtons}>
                    <TouchableOpacity style={styles.uberButton}>
                      <Text style={styles.deliveryButtonText}>Uber Eats</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.doordashButton}>
                      <Text style={styles.deliveryButtonText}>DoorDash</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.noResultsText}>No food items found.</Text>
        )}
      </ScrollView>
    </View>
  );

  if (!loaded) {
    return null; // or a loading spinner
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for restaurants or recipes"
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity 
          style={[styles.searchButton, isLoading && styles.disabledButton]} 
          onPress={handleSearch}
          disabled={isLoading}
        >
          <Text style={styles.searchButtonText}>
            {isLoading ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>
      {location && Platform.OS !== 'web' ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          onPress={handleMapPress}
        >
          {restaurants.map((restaurant) => (
            <Marker
              key={restaurant.place_id}
              coordinate={{
                latitude: restaurant.geometry.location.lat,
                longitude: restaurant.geometry.location.lng,
              }}
              title={restaurant.name}
              description={restaurant.vicinity}
              onPress={() => handleMarkerPress(restaurant.name)}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.webMapPlaceholder}>
          <Text style={styles.webMapText}>Map view is not available in web version.</Text>
          <Text style={styles.webMapSubtext}>Please use our mobile app for the full mapping experience.</Text>
        </View>
      )}
      {selectedRestaurant && renderPopup()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    fontFamily: 'AfacadFlux',
  },
  searchContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 10,
  },
  searchInput: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 2,
    borderRadius: 15,
    marginBottom: 10,
    paddingHorizontal: 25,
    fontSize: 16,
    color: '#3C4858',
    fontFamily: 'AfacadFlux',
  },
  searchButton: {
    backgroundColor: '#31256C',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 10,
    fontFamily: 'AfacadFlux',
  },
  disabledButton: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  popup: {
    position: 'absolute',
    left: 10,
    top: 130,
    bottom: 10,
    width: '60%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: 'AfacadFlux',
    color: '#31256C',
  },
  resultItem: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    borderColor: '#E8EAF6',
    borderWidth: 1,
  },
  foodImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 10,
  },
  placeholderImage: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 10,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
    fontFamily: 'AfacadFlux',
  },
  resultCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 3,
    fontFamily: 'AfacadFlux',
  },
  resultMacros: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'AfacadFlux',
  },
  buttonRow: {
    flexDirection: 'column',
  },
  addButton: {
    backgroundColor: '#31256C',
    padding: 8,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  deliveryButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  uberButton: {
    flex: 1,
    backgroundColor: '#31256C',
    padding: 5,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 3,
  },
  doordashButton: {
    flex: 1,
    backgroundColor: '#31256C',
    padding: 5,
    borderRadius: 10,
    alignItems: 'center',
    marginLeft: 3,
  },
  deliveryButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
  webMapPlaceholder: {
    width: '100%',
    height: 400,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginTop: 70,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    marginBottom: 10,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'AfacadFlux',
  },
});