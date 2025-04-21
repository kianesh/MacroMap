import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import CryptoJS from 'crypto-js';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useCallback, useEffect, useState, useRef } from 'react'; // Added useRef
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cacheImageUrl, getCachedImageUrl } from '../utils/imageCache';
import { openAILimiter } from '../utils/rateLimiter';

// Get environment variables from Expo Constants
const {
  FATSECRET_CLIENT_KEY,
  FATSECRET_CLIENT_SECRET,
  GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
  GOOGLE_CUSTOM_SEARCH_API_KEY
} = Constants.expoConfig?.extra || {};

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

  // Use a ref to track the current search operation ID
  const currentSearchId = useRef<number>(0);

  const functions = getFunctions();
  const findFoodImage = httpsCallable(functions, 'findFoodImage');

  const [processingImageIds, setProcessingImageIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const ITEMS_PER_PAGE = 15;

  const getPaginatedResults = useCallback(() => {
    const startIndex = currentPage * ITEMS_PER_PAGE;
    return results.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [results, currentPage]);

  const goToNextPage = () => {
    if ((currentPage + 1) * ITEMS_PER_PAGE < results.length) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

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

  const triggerSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      return;
    }

    // Increment search ID to invalidate previous operations
    const searchId = ++currentSearchId.current;

    // --- Clear previous state IMMEDIATELY ---
    setResults([]);
    setCurrentPage(0);
    setIsLoading(true);
    setIsLoadingImages(false); // Stop any ongoing image loading indicators
    // --- End Clearing ---

    await saveRecentSearch(searchTerm);

    try {
      const method = 'GET';
      const path = FATSECRET_API_URL;
      const params = {
        method: 'foods.search',
        search_expression: searchTerm,
        format: 'json',
        max_results: 50, // Fetch more results initially if needed for pagination
        page_number: 0,
      };
      const oauthHeaders = generateOAuthSignature(method, path, params);

      const response = await axios.get(path, { params: { ...params, ...oauthHeaders } });

      // --- Check if this search is still the current one ---
      if (searchId !== currentSearchId.current) {
        console.log("Search aborted, new search started.");
        return; // Abort if a newer search has begun
      }
      // --- End Check ---

      if (response.data.foods?.food) {
        const foods = Array.isArray(response.data.foods.food)
          ? response.data.foods.food
          : [response.data.foods.food];

        const transformedResults = foods.map(food => {
          // Extract food details
          const foodDetails = typeof food.food_description === 'string'
            ? food.food_description
            : '';

          // Parse macros from the food description
          const caloriesMatch = foodDetails.match(/Calories: (\d+)kcal/);
          const fatMatch = foodDetails.match(/Fat: ([\d.]+)g/);
          const carbsMatch = foodDetails.match(/Carbs: ([\d.]+)g/);
          const proteinMatch = foodDetails.match(/Protein: ([\d.]+)g/);

          return {
            food_name: food.food_name,
            brand_name: food.brand_name || '',
            serving_qty: 1,
            serving_unit: 'serving',
            nf_calories: caloriesMatch ? parseInt(caloriesMatch[1]) : 0,
            nf_total_fat: fatMatch ? parseFloat(fatMatch[1]) : 0,
            nf_total_carbohydrate: carbsMatch ? parseFloat(carbsMatch[1]) : 0,
            nf_protein: proteinMatch ? parseFloat(proteinMatch[1]) : 0,
            image_url: undefined, // Initialize image_url as undefined
          };
        });

        // --- Check again before setting state ---
        if (searchId === currentSearchId.current) {
          setResults(transformedResults);
          // Trigger image processing for the *first page* of new results
          processImagesSequentially(transformedResults.slice(0, ITEMS_PER_PAGE), searchId);
        }
        // --- End Check ---

      } else {
         // --- Check again before setting state ---
         if (searchId === currentSearchId.current) {
            setResults([]); // Ensure results are cleared if API returns no food
         }
         // --- End Check ---
      }
    } catch (error) {
      console.error('Error searching foods:', error);
       // --- Check again before setting state ---
       if (searchId === currentSearchId.current) {
          alert('Failed to search for foods. Please try again.');
          setResults([]); // Clear results on error too
       }
       // --- End Check ---
    } finally {
       // --- Check again before setting state ---
       if (searchId === currentSearchId.current) {
          setIsLoading(false);
       }
       // --- End Check ---
    }
  };

  const searchFoods = async () => {
    await triggerSearch(query);
  };

  const handleRecentSearchPress = async (searchTerm: string) => {
    setQuery(searchTerm);
    await triggerSearch(searchTerm);
  };

  // Modified to accept searchId
  const processImagesSequentially = useCallback(async (itemsToProcess: NutritionInfo[], searchId: number) => {
    // --- Check if this process belongs to the current search ---
    if (searchId !== currentSearchId.current) {
        console.log("Image processing aborted for old search.");
        return;
    }
    // --- End Check ---

    setIsLoadingImages(true);

    // Get current results state to check against
    const currentResults = results; // Capture current state

    for (const item of itemsToProcess) {
        // --- Check again for cancellation before each image fetch ---
        if (searchId !== currentSearchId.current) {
            console.log("Image processing loop aborted for old search.");
            break; // Exit loop if a new search started
        }
        // --- End Check ---

        // Find the index in the *full* results array
        const fullResultIndex = currentResults.findIndex(
            r => r.food_name === item.food_name && r.brand_name === item.brand_name
        );

        // Check if the item exists and *still* needs an image in the current state
        if (fullResultIndex >= 0 && !currentResults[fullResultIndex]?.image_url) {
            await findImageWithLLM(item, fullResultIndex, searchId); // Pass searchId
            // Add a small delay between API calls if needed by rate limiter or politeness
            await new Promise(resolve => setTimeout(resolve, 500)); // Shorter delay ok if rate limiter handles it
        }
    }

    // --- Check before final state update ---
    if (searchId === currentSearchId.current) {
        setIsLoadingImages(false);
    }
    // --- End Check ---
  }, [results]); // Keep 'results' dependency for finding index, but rely on searchId for validity

  // Modified to accept searchId
  const findImageWithLLM = async (item: NutritionInfo, index: number, searchId: number) => {
    // --- Check if this operation belongs to the current search ---
    if (searchId !== currentSearchId.current) {
        console.log(`Image fetch for "${item.food_name}" aborted (old search).`);
        return;
    }
    // --- End Check ---

    try {
      // 1. Check cache first
      const cachedImageUrl = await getCachedImageUrl(item.food_name, item.brand_name);
      if (cachedImageUrl) {
        // --- Check searchId again before updating state ---
        if (searchId === currentSearchId.current) {
          setResults(prev => {
            // Prevent unnecessary updates if URL is already there
            if (prev[index]?.image_url === cachedImageUrl) return prev;
            const updated = [...prev];
            if (updated[index]) { // Ensure index is valid
                updated[index] = { ...updated[index], image_url: cachedImageUrl };
            }
            return updated;
          });
        }
        // --- End Check ---
        return; // Found in cache, no need to fetch
      }

      // 2. If not cached, fetch using Google Search (rate limited)
      const query = `${item.food_name} ${item.brand_name || ''} food photo`;
      const searchResponse = await openAILimiter.schedule(() =>
        axios.get('https://www.googleapis.com/customsearch/v1', {
          params: { /* ... your params ... */
            key: GOOGLE_CUSTOM_SEARCH_API_KEY,
            cx: GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
            q: query,
            searchType: 'image',
            num: 1, // Only need the top result
            imgSize: 'medium',
            safe: 'active',
          }
        })
      );

      // --- Check searchId again after await ---
      if (searchId !== currentSearchId.current) {
        console.log(`Image fetch result for "${item.food_name}" discarded (old search).`);
        return;
      }
      // --- End Check ---

      if (searchResponse.data.items && searchResponse.data.items.length > 0) {
        const bestImageUrl = searchResponse.data.items[0].link;

        // --- Check searchId before state update ---
        if (searchId === currentSearchId.current) {
          setResults(prev => {
            // Prevent unnecessary updates
            if (prev[index]?.image_url === bestImageUrl) return prev;
            const updated = [...prev];
             if (updated[index]) { // Ensure index is valid
                updated[index] = { ...updated[index], image_url: bestImageUrl };
             }
            return updated;
          });
          // Cache the newly fetched image
          await cacheImageUrl(item.food_name, item.brand_name, bestImageUrl);
        }
        // --- End Check ---
      } else {
         // Optional: Set a placeholder or default image if none found
         if (searchId === currentSearchId.current) {
             setResults(prev => {
                 if (prev[index]?.image_url === 'placeholder_or_null') return prev; // Avoid update if already placeholder
                 const updated = [...prev];
                 if (updated[index]) {
                     updated[index] = { ...updated[index], image_url: 'placeholder_or_null' }; // Or null
                 }
                 return updated;
             });
         }
      }

    } catch (error) {
      console.error(`Error finding food image for ${item.food_name}:`, error);
       // Optional: Set placeholder on error too
       if (searchId === currentSearchId.current) {
           setResults(prev => {
               if (prev[index]?.image_url === 'placeholder_or_null') return prev;
               const updated = [...prev];
               if (updated[index]) {
                   updated[index] = { ...updated[index], image_url: 'placeholder_or_null' }; // Or null
               }
               return updated;
           });
       }
    }
  };

  // Effect to load images for the current page
  useEffect(() => {
    const currentItems = getPaginatedResults();
    const itemsWithoutImages = currentItems.filter(item => !item.image_url);

    if (itemsWithoutImages.length > 0 && !isLoadingImages) {
      // Pass the current searchId to the processing function
      processImagesSequentially(itemsWithoutImages, currentSearchId.current);
    }
  }, [currentPage, results, isLoadingImages]); // Depend on results to re-trigger if results change


  // --- Render Logic ---
  return (
    <View style={styles.container}>
      {/* Search Input and Button */}
      <View style={styles.searchInputContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for meals"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={searchFoods} // Allow searching via keyboard
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchIconButton}
          onPress={searchFoods}
          disabled={isLoading} // Disable button while loading main results
        >
          {/* Show spinner only for main search loading */}
          <FontAwesome name={isLoading ? 'spinner' : 'search'} size={20} color="#FFFFFF" spin={isLoading} />
        </TouchableOpacity>
      </View>

      {/* Recent Searches */}
      {/* ... (Keep recent searches JSX) ... */}
       {recentSearches.length > 0 && !isLoading && results.length === 0 && ( // Show only if not loading and no results yet
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
                onPress={() => handleRecentSearchPress(search)}
              >
                <Text style={styles.recentSearchText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}


      {/* Results Area */}
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        {/* Loading Indicator for main search */}
        {isLoading && (
           <View style={styles.loadingContainer}>
             <ActivityIndicator size="large" color="#31256C" />
             <Text style={styles.loadingText}>Searching...</Text>
           </View>
        )}

        {/* Display Results */}
        {!isLoading && getPaginatedResults().length > 0 && (
          <>
            {getPaginatedResults().map((result, index) => {
              // Calculate the actual index in the full results array
              const fullIndex = currentPage * ITEMS_PER_PAGE + index;
              const item = results[fullIndex]; // Get the item from the full results

              // Ensure item exists before rendering
              if (!item) return null;

              return (
                // Make the whole item touchable
                <TouchableOpacity
                  key={`${item.food_name}-${item.brand_name}-${fullIndex}`} // More unique key
                  style={styles.resultItem}
                  onPress={() => {
                    router.push({
                      pathname: '/AdjustServingScreen',
                      params: { meal: JSON.stringify(item) } // Pass the correct item
                    });
                  }}
                  activeOpacity={0.7}
                >
                  {/* Image or Placeholder */}
                  {item.image_url && item.image_url !== 'placeholder_or_null' ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.foodImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.foodImage, styles.placeholderImage]}>
                      {/* Show spinner only if image loading is active for *this* page */}
                      {isLoadingImages && !item.image_url ? (
                         <ActivityIndicator size="small" color="#31256C" />
                      ) : (
                         <FontAwesome name="image" size={24} color="#ccc" /> // Placeholder icon
                      )}
                      <Text style={styles.placeholderText}>
                        {isLoadingImages && !item.image_url ? 'Loading...' : 'No Image'}
                      </Text>
                    </View>
                  )}

                  {/* Text Content */}
                  <View style={styles.resultContent}>
                    <Text style={styles.resultName} numberOfLines={2}>{item.food_name}</Text>
                    {item.brand_name && (
                      <Text style={styles.resultBrand} numberOfLines={1}>{item.brand_name}</Text>
                    )}
                    <Text style={styles.resultMacros}>
                      Cal: {item.nf_calories} • P: {item.nf_protein}g • C: {item.nf_total_carbohydrate}g • F: {item.nf_total_fat}g
                    </Text>
                  </View>

                  {/* Chevron Icon */}
                  <View style={styles.chevronContainer}>
                    <FontAwesome name="chevron-right" size={20} color="#B0B0B0" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* No Results Message or Create Custom */}
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

        {/* Create Custom Footer (only if results exist) */}
        {!isLoading && results.length > 0 && (
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

      {/* Pagination Controls (only show if there are results and more than one page) */}
      {!isLoading && results.length > ITEMS_PER_PAGE && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
            onPress={goToPreviousPage}
            disabled={currentPage === 0}
          >
            <FontAwesome name="chevron-left" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.paginationText}>
            Page {currentPage + 1} of {Math.ceil(results.length / ITEMS_PER_PAGE)}
          </Text>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              (currentPage + 1) * ITEMS_PER_PAGE >= results.length && styles.paginationButtonDisabled
            ]}
            onPress={goToNextPage}
            disabled={(currentPage + 1) * ITEMS_PER_PAGE >= results.length}
          >
             <FontAwesome name="chevron-right" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Remove padding here, add to specific containers if needed
    backgroundColor: '#FAFAFA',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15, // Add padding here
    paddingTop: 15, // Add top padding
    paddingBottom: 10,
    backgroundColor: '#FAFAFA', // Match background
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0', // Lighter border
    borderWidth: 1, // Thinner border
    borderRadius: 25, // More rounded
    paddingHorizontal: 20,
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
  scrollContentContainer: {
     paddingHorizontal: 15, // Add horizontal padding for scroll content
     paddingBottom: 80, // Add padding at the bottom to avoid overlap with pagination
  },
  loadingContainer: { // Centered loading for main search
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     paddingVertical: 50,
  },
  loadingText: {
     marginTop: 10,
     fontSize: 16,
     color: '#666',
     fontFamily: 'AfacadFlux',
  },
  resultItem: {
    marginBottom: 12, // Slightly less margin
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12, // More rounded
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, // Smaller shadow
    shadowOpacity: 0.08, // Lighter shadow
    shadowRadius: 3,
    elevation: 2, // Android shadow
    flexDirection: 'row',
    alignItems: 'center', // Vertically align items
  },
  foodImage: {
    width: 70, // Slightly smaller image
    height: 70,
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
    fontSize: 10, // Smaller text
    marginTop: 4,
    textAlign: 'center',
  },
  resultContent: {
    flex: 1, // Takes remaining space
    justifyContent: 'center', // Center content vertically
  },
  resultName: {
    fontSize: 17, // Slightly smaller
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
    color: '#333', // Darker text
    marginBottom: 2,
  },
  resultBrand: {
    fontSize: 14, // Smaller brand
    color: '#777', // Lighter grey
    fontFamily: 'AfacadFlux',
    marginBottom: 4,
  },
  resultMacros: {
    fontSize: 13, // Smaller macros
    color: '#555',
    fontFamily: 'AfacadFlux',
    lineHeight: 18, // Adjust line height
  },
  chevronContainer: {
    justifyContent: 'center', // Center chevron vertically
    paddingLeft: 10, // Space before chevron
  },
  // Remove logButton styles
  // Remove linkButton styles
  noResultsText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginTop: 30, // More margin top
    marginBottom: 10,
    fontFamily: 'AfacadFlux',
  },
  recentSearchesContainer: {
    paddingHorizontal: 15, // Match scroll content padding
    marginBottom: 15,
    marginTop: 5,
  },
  recentSearchesTitle: {
    fontSize: 15, // Slightly smaller title
    fontWeight: '600',
    color: '#31256C',
    marginBottom: 10, // More space below title
    fontFamily: 'AfacadFlux',
  },
  recentSearchScroll: {
    // No specific style needed, handled by ScrollView props
  },
  recentSearchChip: {
    backgroundColor: '#E8EAF6',
    borderRadius: 16, // More rounded
    paddingVertical: 6, // Adjust padding
    paddingHorizontal: 14,
    marginRight: 8,
  },
  recentSearchText: {
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    fontSize: 14,
  },
  createCustomContainer: { // Styling for "No results" block
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    marginTop: 20, // Adjust margin
    marginHorizontal: 10, // Add horizontal margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  createCustomText: { // Text within the "No results" block
    fontSize: 16, // Adjust size
    color: '#555', // Adjust color
    marginVertical: 15,
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
  },
  createCustomButton: { // Button within the "No results" block
    flexDirection: 'row',
    backgroundColor: '#31256C',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25, // More rounded
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
  createCustomFooter: { // Footer link to create custom
    marginTop: 25,
    marginBottom: 20, // Reduced bottom margin as scroll padding handles it
    alignItems: 'center',
  },
  createCustomFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Adjust padding
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#CBD5E0', // Lighter border
    borderRadius: 20, // More rounded
    backgroundColor: '#fff',
  },
  createCustomFooterText: {
    fontSize: 15, // Adjust size
    color: '#31256C',
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
  // Remove findImageButton styles
  paginationContainer: {
    position: 'absolute', // Fix pagination to bottom
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#FAFAFA', // Match background
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  paginationButton: {
    backgroundColor: '#31256C',
    padding: 10, // Make touch target bigger
    borderRadius: 20, // Circle buttons
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.7,
  },
  paginationButtonText: { // Remove this, using icons now
    // color: '#FFFFFF',
    // fontFamily: 'AfacadFlux',
    // fontSize: 14,
    // fontWeight: '600',
  },
  paginationText: {
    fontFamily: 'AfacadFlux',
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingImagesContainer: { // Remove this, handled inline now
    // flexDirection: 'row',
    // justifyContent: 'center',
    // alignItems: 'center',
    // padding: 10,
    // marginBottom: 15,
  },
  loadingImagesText: { // Remove this
    // marginLeft: 10,
    // color: '#31256C',
    // fontFamily: 'AfacadFlux',
  },
});