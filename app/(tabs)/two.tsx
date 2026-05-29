import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cacheImageUrl, getCachedImageUrl } from '../../utils/imageCache';

// Conditionally import MapView
let MapView: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
}

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
  types?: string[];
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
  const [query, setQuery] = useState('');
  const [processingImageIds, setProcessingImageIds] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Restaurant[]>([]);
  const [foodResults, setFoodResults] = useState<NutritionInfo[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const router = useRouter();

  const firebaseFunctions = getFunctions();
  const searchFoodsCallable = httpsCallable(firebaseFunctions, 'searchFoods');
  const searchNearbyCallable = httpsCallable(firebaseFunctions, 'searchNearbyRestaurants');
  const findFoodImageCallable = httpsCallable(firebaseFunctions, 'findFoodImage');

  const [loaded, error] = useFonts({
    'AfacadFlux': require('../../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
    
    loadRecentSearches();
    getUserLocation();
  }, [loaded, error]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // fallback if denied
        setLocation({ latitude: 37.7749, longitude: -122.4194 });
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);
      await fetchNearbyRestaurants(coords);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };
  
  const fetchNearbyRestaurants = async (coords: LocationCoords) => {
    try {
      const result = await searchNearbyCallable({
        lat: coords.latitude,
        lng: coords.longitude,
      });
      setNearbyRestaurants((result.data as any).restaurants || []);
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const savedSearches = await AsyncStorage.getItem('recentMapSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (search: string) => {
    try {
      const currentSearches = await AsyncStorage.getItem('recentMapSearches');
      let searches = currentSearches ? JSON.parse(currentSearches) : [];
      
      // Remove if exists already and add to front
      searches = searches.filter((s: string) => s !== search);
      searches.unshift(search);
      
      // Keep only most recent 5
      searches = searches.slice(0, 5);
      
      await AsyncStorage.setItem('recentMapSearches', JSON.stringify(searches));
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  // Main search function
  const searchFoods = async (restaurantName = query) => {
    if (!restaurantName.trim()) return;

    setProcessingImageIds(new Set());
    await saveRecentSearch(restaurantName);
    setIsLoading(true);

    try {
      const callResult = await searchFoodsCallable({ query: restaurantName });
      const transformedResults = ((callResult.data as any).foods || []) as NutritionInfo[];
      setFoodResults(transformedResults);
      if (transformedResults.length > 0) {
        setTimeout(() => processImagesSequentially(transformedResults), 500);
      }
    } catch (error) {
      console.error('Error searching foods:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sequential image processing
  const processImagesSequentially = async (items: NutritionInfo[]) => {
    const processingIds = new Set<string>();
    
    // Get items that need images
    const needsImage = items.filter(item => {
      const itemId = `${item.food_name}_${item.brand_name || ''}`;
      if (item.image_url || processingIds.has(itemId)) return false;
      processingIds.add(itemId);
      return true;
    });
    
    // Process one at a time
    for (const item of needsImage) {
      const index = foodResults.findIndex(
        r => r.food_name === item.food_name && r.brand_name === item.brand_name
      );
      
      if (index >= 0) {
        try {
          // Just use direct image search without LLM
          const imageUrl = await findSimpleImage(item.food_name, item.brand_name || '');
          if (imageUrl) {
            const updatedResults = [...foodResults];
            updatedResults[index] = {
              ...updatedResults[index],
              image_url: imageUrl
            };
            setFoodResults(updatedResults);
          }
        } catch (error) {
          console.error('Error finding image:', error);
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  };
  
  // Simple function to find image via Cloud Function
  const findSimpleImage = async (foodName: string, brandName: string): Promise<string | null> => {
    try {
      const cachedImageUrl = await getCachedImageUrl(foodName, brandName);
      if (cachedImageUrl) return cachedImageUrl;

      const imageQuery = `${foodName} ${brandName} food photo`;
      const callResult = await findFoodImageCallable({ query: imageQuery });
      const imageUrl = (callResult.data as any).imageUrl as string | null;
      if (imageUrl) {
        await cacheImageUrl(foodName, brandName, imageUrl);
        return imageUrl;
      }
      return null;
    } catch (error) {
      console.error('Error finding simple image:', error);
      return null;
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    searchFoods();
    setSelectedRestaurant(query);
  };

  const handleMarkerPress = (restaurant: Restaurant) => {
    const restaurantName = restaurant.name;
    setSelectedRestaurant(restaurantName);
    setQuery(restaurantName);
    
    // Clear any previous search results
    setProcessingImageIds(new Set());
    
    // Save to recent searches and perform the search
    saveRecentSearch(restaurantName).then(() => {
      // Search specialized menu items for this restaurant
      searchFoods(`${restaurantName} menu items`);
    });
  };

  const handleMapPress = () => {
    // Hide the popup when clicking elsewhere on the map
    setSelectedRestaurant(null);
  };

  // Define the handleRecentSearchPress function inside the component
  const handleRecentSearchPress = (searchTerm: string) => {
    setQuery(searchTerm);
    searchFoods(searchTerm);
  };

  const renderPopup = () => (
    <View style={styles.popup}>
      <Text style={styles.popupTitle}>{selectedRestaurant}</Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#31256C" />
          <Text style={styles.loadingText}>Finding menu items...</Text>
        </View>
      ) : foodResults.length > 0 ? (
        <ScrollView>
          {foodResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              {result.image_url ? (
                <Image 
                  source={{ uri: result.image_url }} 
                  style={styles.foodImage}
                />
              ) : (
                <View style={[styles.foodImage, styles.placeholderImage]}>
                  <Text style={styles.placeholderText}>Loading...</Text>
                  <ActivityIndicator size="small" color="#31256C" />
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
              </View>
              
              <TouchableOpacity 
                style={styles.chevronContainer}
                onPress={() => {
                  router.push({
                    pathname: '/AdjustServingScreen',
                    params: { meal: JSON.stringify(result) }
                  });
                }}
              >
                <FontAwesome name="chevron-right" size={18} color="#999" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.noResultsText}>
          No menu items found for this restaurant
        </Text>
      )}
    </View>
  );

  if (!loaded) return null;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for restaurants..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchIconButton} onPress={handleSearch}>
            <FontAwesome name="search" size={20} color="#fff" />
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
                onPress={() => handleRecentSearchPress(search)}
              >
                <Text style={styles.recentSearchText}>{search}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {isLoadingLocation ? (
        <View style={styles.loadingLocationContainer}>
          <ActivityIndicator size="large" color="#31256C" />
          <Text>Detecting your location...</Text>
        </View>
      ) : Platform.OS !== 'web' && MapView ? (
        <MapView
          style={styles.map}
          region={{
            latitude: location ? location.latitude : 37.78825,
            longitude: location ? location.longitude : -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          showsUserLocation={true}
          onPress={handleMapPress}
        >
          {nearbyRestaurants.map((restaurant) => (
            <Marker
              key={restaurant.place_id}
              coordinate={{
                latitude: restaurant.geometry.location.lat,
                longitude: restaurant.geometry.location.lng
              }}
              title={restaurant.name}
              description={restaurant.vicinity}
              onPress={() => handleMarkerPress(restaurant)}
            >
              <View style={styles.customMarker}>
                <View style={styles.markerBody}>
                  <FontAwesome name="cutlery" size={14} color="white" />
                </View>
                <View style={styles.markerTail} />
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.mapFallback}>
          <Text style={styles.mapFallbackText}>
            Map is not available on this platform.
          </Text>
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  customMarker: {
    alignItems: 'center',
  },
  markerBody: {
    backgroundColor: '#31256C',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  markerTail: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#31256C',
    transform: [{ rotate: '180deg' }]
  },
  loadingLocationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapFallback: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  mapFallbackText: {
    fontSize: 16,
    color: '#666',
  },
});