import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import { useFonts } from 'expo-font';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import OpenAI from 'openai';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FATSECRET_CLIENT_KEY, FATSECRET_CLIENT_SECRET, GOOGLE_MAPS_API_KEY, OPENAI_API_KEY } from 'react-native-dotenv';

const GOOGLE_CUSTOM_SEARCH_ENGINE_ID = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
const GOOGLE_CUSTOM_SEARCH_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;

// Conditionally import MapView
let MapView: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();
  
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
      
      // Load recent searches
      loadRecentSearches();
    })();
  }, [loaded, error]);

  const loadRecentSearches = async () => {
    try {
      const savedSearches = await AsyncStorage.getItem('recentMapSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Failed to load recent searches', error);
    }
  };

  const saveRecentSearch = async (search: string) => {
    try {
      let updatedSearches = [search];
      const existingSearches = recentSearches.filter(item => item !== search);
      
      updatedSearches = [...updatedSearches, ...existingSearches].slice(0, 5);
      setRecentSearches(updatedSearches);
      
      await AsyncStorage.setItem('recentMapSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Failed to save recent search', error);
    }
  };

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
    if (!restaurantName.trim()) return;

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

        setFoodResults(foodDetails);
        
        // Then automatically find images for all results that don't have one
        foodDetails.forEach((item, index) => {
          if (!item.image_url) {
            findImageWithLLM(item, index);
          }
        });
      } else {
        setFoodResults([]);
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
      // Skip if image already exists
      if (item.image_url) return;
      
      const query = `${item.food_name} ${item.brand_name || ''} food photo`;
      
      // Step 1: Get image candidates using Google Custom Search API
      const searchResponse = await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: GOOGLE_CUSTOM_SEARCH_API_KEY,
            cx: GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
            q: query,
            searchType: 'image',
            num: 5,
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
          const updatedResults = [...foodResults];
          updatedResults[index] = {
            ...updatedResults[index],
            image_url: match[1]
          };
          setFoodResults(updatedResults);
          return;
        }
      }
      
      // Fallback to first image if LLM selection fails
      const updatedResults = [...foodResults];
      updatedResults[index] = {
        ...updatedResults[index],
        image_url: images[0].url
      };
      setFoodResults(updatedResults);
    } catch (error) {
      console.error('Error finding food image with LLM:', error);
    }
  };

  const handleSearch = async () => {
    if (!query) return;
    
    // Save recent search
    await saveRecentSearch(query);
    
    await fetchNearbyRestaurants(query);
    setSelectedRestaurant(query);
    await searchFoods(query);
  };

  const handleMarkerPress = async (restaurant: Restaurant) => {
    const restaurantName = restaurant.name;
    setSelectedRestaurant(restaurantName);
    setQuery(restaurantName);
    await saveRecentSearch(restaurantName);
    
    // Use the enhanced function instead of basic searchFoods
    await getEnhancedRestaurantInfo(
      restaurantName, 
      { lat: restaurant.geometry.location.lat, lng: restaurant.geometry.location.lng }
    );
  };

  const handleMapPress = () => {
    setSelectedRestaurant(null);
    setFoodResults([]);
  };

  const renderPopup = () => (
    <View style={styles.popup}>
      <Text style={styles.popupTitle}>{selectedRestaurant}</Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#31256C" />
          <Text style={styles.loadingText}>Finding menu items...</Text>
        </View>
      ) : (
        <ScrollView>
          {foodResults.length > 0 ? (
            foodResults.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                {result.image_url ? (
                  <Image 
                    source={{ uri: result.image_url }} 
                    style={styles.foodImage}
                  />
                ) : (
                  <View style={[styles.foodImage, styles.placeholderImage]}>
                    <Text style={styles.placeholderText}>No Image</Text>
                  </View>
                )}
                <View style={styles.resultContent}>
                  <Text style={styles.resultName}>{result.food_name}</Text>
                  {result.brand_name && (
                    <Text style={styles.resultBrand}>{result.brand_name}</Text>
                  )}
                  <Text style={styles.resultMacros}>
                    Cal: {result.nf_calories} • P: {result.nf_protein}g • 
                    C: {result.nf_total_carbohydrate}g • F: {result.nf_total_fat}g
                  </Text>
                  <TouchableOpacity
                    style={styles.logButton}
                    onPress={() => {
                      router.push({
                        pathname: '/AdjustServingScreen',
                        params: { meal: JSON.stringify(result) }
                      });
                    }}
                  >
                    <Text style={styles.logButtonText}>Log</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noResultsText}>
              No menu information found for this restaurant
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );

  if (!loaded) {
    return null; // or a loading spinner
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for restaurants or recipes"
            value={query}
            onChangeText={setQuery}
          />
          <TouchableOpacity 
            style={styles.searchIconButton} 
            onPress={handleSearch}
            disabled={isLoading}
          >
            <FontAwesome name="search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        {recentSearches.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.recentSearchesContainer}
          >
            {recentSearches.map((search, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.recentSearchChip}
                onPress={() => {
                  setQuery(search);
                  handleSearch();
                }}
              >
                <Text style={styles.recentSearchText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      
      {location && (
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
          {/* User location marker */}
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="You are here"
            pinColor="#31256C" // Purple marker for user
          />
          
          {/* Restaurant markers */}
          {restaurants.map((restaurant) => (
            <Marker
              key={restaurant.place_id}
              coordinate={{
                latitude: restaurant.geometry.location.lat,
                longitude: restaurant.geometry.location.lng,
              }}
              title={restaurant.name}
              description={restaurant.vicinity}
              onPress={() => {
                setQuery(restaurant.name);
                handleMarkerPress(restaurant);
              }}
            />
          ))}
        </MapView>
      )}
      {selectedRestaurant && renderPopup()}
    </View>
  );

  // Initialize OpenAI client inside the component
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });

  // Move all these functions inside the component
  /**
   * Gets enhanced restaurant information using LLM and web search data
   * @param restaurantName Name of the selected restaurant
   * @param location Restaurant location coordinates
   */
  const getEnhancedRestaurantInfo = async (
    restaurantName: string, 
    location: { lat: number, lng: number }
  ) => {
    setIsLoading(true);
    try {
      // Step 1: Get restaurant details from Google Places API
      const placeDetails = await fetchRestaurantDetails(restaurantName, location);
      
      // Step 2: Search web for additional menu information
      const webSearchResults = await searchWebForRestaurantMenu(restaurantName);
      
      // Step 3: Use LLM to generate structured food items based on the data
      const structuredFoodItems = await generateStructuredFoodItems(
        restaurantName, 
        placeDetails, 
        webSearchResults
      );
      
      // Update food results
      setFoodResults(structuredFoodItems);
    } catch (error) {
      console.error('Error getting enhanced restaurant info:', error);
      // Fall back to basic search
      searchFoods(restaurantName);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetch restaurant details from Google Places API
   */
  const fetchRestaurantDetails = async (
    restaurantName: string, 
    location: { lat: number, lng: number }
  ) => {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          key: GOOGLE_MAPS_API_KEY,
          place_id: restaurants.find(r => r.name === restaurantName)?.place_id || '',
          fields: 'name,rating,formatted_address,formatted_phone_number,website,price_level,review'
        }
      }
    );
    
    return response.data.result || {};
  };

  /**
   * Search the web for restaurant menu information
   */
  const searchWebForRestaurantMenu = async (restaurantName: string) => {
    try {
      // Use Google Custom Search API to find menu information
      const response = await axios.get(
        'https://www.googleapis.com/customsearch/v1',
        {
          params: {
            key: GOOGLE_MAPS_API_KEY,
            cx: '65bc6b17f0d9145d0',
            q: `${restaurantName} menu popular dishes nutrition information`,
            num: 5
          }
        }
      );
      
      // Extract relevant snippets from search results
      return response.data.items?.map(item => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link
      })) || [];
    } catch (error) {
      console.error('Error searching web for restaurant menu:', error);
      return [];
    }
  };

  /**
   * Use LLM to generate structured food items based on search data
   */
  const generateStructuredFoodItems = async (
    restaurantName: string,
    placeDetails: any,
    webSearchResults: any[]
  ) => {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are an expert nutritionist specializing in restaurant menus. 
            Your task is to generate structured nutrition information for popular items at restaurants.
            You should return JSON data for 5-8 popular menu items with reasonable nutrition estimates.`
          },
          {
            role: "user",
            content: `Generate structured nutrition information for popular menu items at ${restaurantName}.
            
            Restaurant details:
            ${JSON.stringify(placeDetails)}
            
            Web search information:
            ${JSON.stringify(webSearchResults)}
            
            Return a JSON array of food items with this exact structure:
            [
              {
                "food_name": "Item Name",
                "brand_name": "${restaurantName}",
                "serving_qty": 1,
                "serving_unit": "serving",
                "nf_calories": 800,
                "nf_total_fat": 40,
                "nf_protein": 25,
                "nf_total_carbohydrate": 80
              }
            ]
            
            Make reasonable estimates for nutrition values if exact information isn't available.
            The response should ONLY include the JSON array, nothing else.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = completion.choices[0]?.message?.content;
      if (!result) return [];
      
      const parsedResult = JSON.parse(result);
      const foodItems = parsedResult.items || [];
      
      // Find images for all food items
      return await findImagesForFoodItems(foodItems);
    } catch (error) {
      console.error('Error generating structured food items:', error);
      return [];
    }
  };

  // Add this function to get images for the food items
  const findImagesForFoodItems = async (foodItems: NutritionInfo[]) => {
    const itemsWithImages = [...foodItems];
    
    for (let i = 0; i < itemsWithImages.length; i++) {
      try {
        const item = itemsWithImages[i];
        if (item.image_url) continue;
        
        const query = `${item.food_name} from ${item.brand_name} restaurant food photo`;
        
        const searchResponse = await axios.get(
          'https://www.googleapis.com/customsearch/v1',
          {
            params: {
              key: GOOGLE_MAPS_API_KEY,
              cx: '65bc6b17f0d9145d0', // Your search engine ID
              q: query,
              searchType: 'image',
              num: 1,
              imgSize: 'medium',
              safe: 'active',
            }
          }
        );
        
        if (searchResponse.data.items && searchResponse.data.items.length > 0) {
          itemsWithImages[i] = {
            ...itemsWithImages[i],
            image_url: searchResponse.data.items[0].link
          };
        }
      } catch (error) {
        console.error('Error finding image for food item:', error);
      }
    }
    
    return itemsWithImages;
  };
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
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
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
  searchIconButton: {
    backgroundColor: '#31256C',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
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
    width: '75%',
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
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    borderColor: '#E8EAF6',
    borderWidth: 1,
  },
  foodImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
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
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
    marginTop: 15,
    color: '#31256C',
  },
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
  recentSearchesContainer: {
    marginBottom: 10,
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
  chevronContainer: {
    justifyContent: 'center',
    paddingLeft: 10,
  },
  logButton: {
    backgroundColor: '#31256C',
    padding: 10,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
    width: 80,
  },
  logButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'AfacadFlux',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});