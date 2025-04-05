import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../FirebaseConfig';

// Constants for web version
const FATSECRET_CLIENT_KEY = '2e3df77a4d7a4481a05a9d79152e64ad';
const FATSECRET_CLIENT_SECRET = '8591547e4ea24556a46a8005398fb5ba';
const FATSECRET_API_URL = 'https://platform.fatsecret.com/rest/server.api';

SplashScreen.preventAutoHideAsync();

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

export default function MapScreenWeb() {
  const [query, setQuery] = useState<string>('');
  const [foodResults, setFoodResults] = useState<NutritionInfo[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();
  const [loaded] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

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

  const searchFoods = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const method = 'GET';
      const params = {
        method: 'foods.search',
        search_expression: query,
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
      setSelectedRestaurant(query);
    } catch (error) {
      console.error('Error searching foods:', error);
      alert('Failed to search for foods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const adjustServing = (meal: NutritionInfo) => {
    router.push(`/AdjustServingScreen?meal=${JSON.stringify(meal)}`);
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
        image_url: meal.image_url,
        timestamp: Timestamp.now(),
      });
      alert('Meal logged successfully!');
    } catch (error) {
      console.error('Error logging meal:', error);
      alert('Failed to log meal. Please try again.');
    }
  };

  if (!loaded) return null;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for food items"
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity 
          style={[styles.searchButton, isLoading && styles.disabledButton]} 
          onPress={searchFoods}
          disabled={isLoading}
        >
          <Text style={styles.searchButtonText}>
            {isLoading ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.webMapPlaceholder}>
        <Text style={styles.webMapText}>Map view is not available in web version</Text>
        <Text style={styles.webMapSubtext}>Use the search above to find foods</Text>
      </View>
      
      {selectedRestaurant && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Results for "{selectedRestaurant}"</Text>
          
          <ScrollView style={{maxHeight: 500}}>
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
                        onPress={() => adjustServing(result)}
                      >
                        <Text style={styles.addButtonText}>Adjust</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.quickAddButton} 
                        onPress={() => logMeal(result)}
                      >
                        <Text style={styles.addButtonText}>Quick Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noResultsText}>No food items found.</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  searchContainer: {
    marginBottom: 20,
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
  webMapPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 20,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#31256C',
    marginBottom: 10,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#666',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    flex: 1,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
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
  },
  resultCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 3,
  },
  resultMacros: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    backgroundColor: '#31256C',
    padding: 8,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 5,
    width: 80,
  },
  quickAddButton: {
    backgroundColor: '#4A3C97',
    padding: 8,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 5,
    width: 80,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
});