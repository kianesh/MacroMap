import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getFunctions, httpsCallable } from 'firebase/functions';
import OpenAI from 'openai';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FATSECRET_CLIENT_KEY, FATSECRET_CLIENT_SECRET, OPENAI_API_KEY } from 'react-native-dotenv';

const GOOGLE_CUSTOM_SEARCH_ENGINE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
const GOOGLE_CUSTOM_SEARCH_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;

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

export default function MealSearchScreen() {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<NutritionInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  const [loaded, error] = useFonts({
    'AfacadFlux': require('../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  const functions = getFunctions();
  const findFoodImage = httpsCallable(functions, 'findFoodImage');

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
    
    loadRecentSearches();
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

  const loadRecentSearches = async () => {
    try {
      const savedSearches = await AsyncStorage.getItem('recentFoodSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Failed to load recent searches', error);
    }
  };

  const saveRecentSearch = async (search: string) => {
    if (!search.trim()) return;
    
    try {
      let updatedSearches = [search];
      const existingSearches = recentSearches.filter(item => item !== search);
      
      updatedSearches = [...updatedSearches, ...existingSearches].slice(0, 5);
      setRecentSearches(updatedSearches);
      
      await AsyncStorage.setItem('recentFoodSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Failed to save recent search', error);
    }
  };

  const searchFoods = async () => {
    if (!query.trim()) {
      alert('Please enter a search term');
      return;
    }

    // Save search term
    await saveRecentSearch(query);
    
    setIsLoading(true);
    try {
      // Option 1: For local development when the Cloud Function isn't deployed yet
      // Continue using your existing direct API call implementation
      
      // Option 2: Once the Cloud Function is deployed, use this:
      /*
      const response = await axios.get(
        `https://YOUR_REGION-YOUR_PROJECT_ID.cloudfunctions.net/getFoodData?query=${encodeURIComponent(query)}`
      );
      
      // Transform the response to match your app's expected format
      const foodDetails = response.data.results.map((item: any) => ({
        food_name: item.food_name,
        brand_name: item.brand || '',
        serving_qty: item.serving_qty || 1,
        serving_unit: item.serving_unit || 'serving',
        nf_calories: item.macros.calories || 0,
        nf_protein: item.macros.protein || 0,
        nf_total_fat: item.macros.fat || 0,
        nf_total_carbohydrate: item.macros.carbs || 0,
        image_url: item.image_url,
        source: item.source // New field to display data source
      }));
      
      setResults(foodDetails);
      */

      // Until the Cloud Function is deployed, use your current implementation:
      const method = 'GET';
      const params = {
        method: 'foods.search',
        search_expression: query,
        format: 'json',
        max_results: 50,
        page_number: 0
      };

      const oauthHeaders = generateOAuthSignature(method, FATSECRET_API_URL, params);

      const response = await axios.get(FATSECRET_API_URL, {
        params: {
          ...params,
          ...oauthHeaders
        }
      });

      console.log('API Response:', response.data);

      if (response.data.foods?.food) {
        const foods = Array.isArray(response.data.foods.food) 
          ? response.data.foods.food 
          : [response.data.foods.food];

        const foodDetails = await Promise.all(
          foods.map(async (food: any) => {
            const detailParams = {
              method: 'food.get.v4',
              food_id: food.food_id,
              format: 'json',
              include_food_images: true,
            };

            const detailHeaders = generateOAuthSignature(method, FATSECRET_API_URL, detailParams);
            const detailResponse = await axios.get(FATSECRET_API_URL, {
              params: {
                ...detailParams,
                ...detailHeaders
              }
            });

            console.log('Detail Response:', detailResponse.data);

            const foodDetail = detailResponse.data.food;
            const primaryServing = Array.isArray(foodDetail.servings.serving) 
              ? foodDetail.servings.serving[0] 
              : foodDetail.servings.serving;

            // Updated image URL handling
            const imageUrl = foodDetail.images?.image?.[0]?.image_url || 
                            foodDetail.food_images?.food_image?.[0]?.image_url || 
                            null;

            return {
              food_name: foodDetail.food_name || 'Unknown Food',
              brand_name: foodDetail.brand_name || '',
              serving_qty: parseFloat(primaryServing.number_of_units) || 1,
              serving_unit: primaryServing.measurement_description || 'serving',
              nf_calories: parseFloat(primaryServing.calories) || 0,
              nf_protein: parseFloat(primaryServing.protein) || 0,
              nf_total_fat: parseFloat(primaryServing.fat) || 0,
              nf_total_carbohydrate: parseFloat(primaryServing.carbohydrate) || 0,
              image_url: imageUrl,
            };
          })
        );

        setResults(foodDetails);

        // Automatically find images for all results that don't have one
        foodDetails.forEach((item, index) => {
          if (!item.image_url) {
            findImageWithLLM(item, index);
          }
        });
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching foods:', error);
      alert('Failed to search for foods. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const findImageWithLLM = async (item: NutritionInfo, index: number) => {
    try {
      // Don't search for images if one already exists
      if (item.image_url) return;
      
      const query = `${item.food_name} ${item.brand_name || ''} food photo`;
      
      // Step 1: Get image candidates using Google Custom Search API
      const searchResponse = await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: GOOGLE_CUSTOM_SEARCH_API_KEY, // Using your existing API key
            cx: GOOGLE_CUSTOM_SEARCH_ENGINE_ID, // Replace with your search engine ID
            q: query,
            searchType: 'image',
            num: 5, // Get multiple images for LLM to choose from
            imgSize: 'medium',
            safe: 'active',
          }
        }
      );
      
      // If no images found, exit early
      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return;
      }
      
      // Step 2: Format the images for LLM evaluation
      const images = searchResponse.data.items.map(item => ({
        url: item.link,
        title: item.title || '',
        snippet: item.snippet || '',
        contextLink: item.image?.contextLink || ''
      }));
      
      // Step 3: Use OpenAI to select the best image
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert food photographer assistant. Your task is to select the most appetizing and accurate image for a specific food item."
          },
          {
            role: "user",
            content: `I'm looking for the best image of "${query}". Please analyze these images and select the BEST ONE based on:
            1. Visual appeal (appetizing, well-lit, professional quality)
            2. Accuracy (most closely matches the food item)
            3. Clear presentation (food is clearly visible, not obscured)
            4. Neutral background (professional food photography style)
               
            Here are the candidate images:
            ${JSON.stringify(images)}
            
            Return ONLY the URL of the best image in this exact format: "BEST_IMAGE_URL: [url]"`
          }
        ]
      });
      
      const result = completion.choices[0]?.message?.content;
      if (result) {
        const match = result.match(/BEST_IMAGE_URL: (https?:\/\/[^\s"]+)/);
        if (match && match[1]) {
          // Update results array with the best image URL
          const updatedResults = [...results];
          updatedResults[index] = {
            ...updatedResults[index],
            image_url: match[1]
          };
          setResults(updatedResults);
          return;
        }
      }
      
      // Fallback to first image if LLM selection fails
      const updatedResults = [...results];
      updatedResults[index] = {
        ...updatedResults[index],
        image_url: images[0].url
      };
      setResults(updatedResults);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios Error Details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.response?.headers,
          config: {
            url: error.config?.url,
            params: error.config?.params,
            headers: error.config?.headers
          }
        });
      } else {
        console.error('Non-Axios error:', error);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchInputContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for meals"
          value={query}
          onChangeText={setQuery}
        />
        <TouchableOpacity 
          style={styles.searchIconButton} 
          onPress={searchFoods}
          disabled={isLoading}
        >
          <FontAwesome name={isLoading ? 'spinner' : 'search'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.recentSearchesContainer}>
          <Text style={styles.recentSearchesTitle}>Recent Searches</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.recentSearchScroll}
          >
            {recentSearches.map((search, index) => (
              <TouchableOpacity
                key={index}
                style={styles.recentSearchChip}
                onPress={() => {
                  setQuery(search);
                  searchFoods();
                }}
              >
                <Text style={styles.recentSearchText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      <ScrollView>
        {results.length > 0 ? (
          results.map((result, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.resultItem}
              onPress={() => router.push(`/AdjustServingScreen?meal=${JSON.stringify(result)}`)}
            >
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
                <Text style={styles.resultBrand}>{result.brand_name}</Text>
                <Text style={styles.resultMacros}>
                  Serving: {result.serving_qty} {result.serving_unit}
                </Text>
                <Text style={styles.resultMacros}>
                  Calories: {result.nf_calories} kcal
                </Text>
                <Text style={styles.resultMacros}>
                  Protein: {result.nf_protein}g • Fat: {result.nf_total_fat}g • Carbs: {result.nf_total_carbohydrate}g
                </Text>
              </View>
              <View style={styles.chevronContainer}>
                <FontAwesome name="chevron-right" size={20} color="#31256C" />
              </View>
              {!result.image_url && (
                <TouchableOpacity 
                  style={styles.findImageButton}
                  onPress={() => findImageWithLLM(result, index)}
                >
                  <Text style={styles.findImageButtonText}>Find Image (AI)</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noResultsText}>
            {isLoading ? 'Loading...' : 'No results found.'}
          </Text>
        )}

        {/* Add this at the end of your ScrollView, right before the closing tag */}
        {!isLoading && results.length === 0 && query.trim() !== '' && (
          <View style={styles.createCustomContainer}>
            <Text style={styles.noResultsText}>No results found for "{query}"</Text>
            <Text style={styles.createCustomText}>Can't find what you're looking for?</Text>
            <TouchableOpacity
              style={styles.createCustomButton}
              onPress={() => router.push('/CreateFoodScreen')}
            >
              <FontAwesome name="plus-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.createCustomButtonText}>Create Custom Food Item</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* If there are results, add this at the bottom */}
        {results.length > 0 && (
          <View style={styles.createCustomFooter}>
            <TouchableOpacity
              style={styles.createCustomFooterButton}
              onPress={() => router.push('/CreateFoodScreen')}
            >
              <FontAwesome name="plus" size={16} color="#31256C" style={{ marginRight: 8 }} />
              <Text style={styles.createCustomFooterText}>Create Your Own Food Item</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
    fontFamily: 'AfacadFlux',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 2,
    borderRadius: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    color: '#3C4858',
    fontFamily: 'AfacadFlux',
  },
  searchIconButton: {
    backgroundColor: '#31256C',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
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
  resultItem: {
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
  },
  foodImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  resultContent: {
    flex: 1,
  },
  resultName: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
  resultBrand: {
    fontSize: 16,
    color: '#888',
    fontFamily: 'AfacadFlux',
  },
  resultMacros: {
    fontSize: 16,
    marginVertical: 5,
    fontFamily: 'AfacadFlux',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  logButton: {
    backgroundColor: '#31256C',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  linkButton: {
    backgroundColor: '#31256C',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
  placeholderImage: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  recentSearchesContainer: {
    marginBottom: 15,
  },
  recentSearchesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 8,
    fontFamily: 'AfacadFlux',
  },
  recentSearchScroll: {
    flexDirection: 'row',
  },
  recentSearchChip: {
    backgroundColor: '#E8EAF6',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  recentSearchText: {
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  createCustomContainer: {
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createCustomText: {
    fontSize: 18,
    color: '#31256C',
    marginVertical: 15,
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
  },
  createCustomButton: {
    flexDirection: 'row',
    backgroundColor: '#31256C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  createCustomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
  createCustomFooter: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  createCustomFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#31256C',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  createCustomFooterText: {
    fontSize: 16,
    color: '#31256C',
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
  findImageButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#31256C',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  findImageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'AfacadFlux',
  },
});