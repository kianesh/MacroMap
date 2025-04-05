import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db, storage } from '../FirebaseConfig';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: number;
  servingUnit?: string;
  imageUrl?: string;
  isCustom?: boolean;
  quantity: number;
}

interface CustomMeal {
  name: string;
  description: string;
  imageUrl?: string;
  foods: FoodItem[];
}

export default function CustomMealsScreen() {
  const [customMeal, setCustomMeal] = useState<CustomMeal>({
    name: '',
    description: '',
    foods: [],
  });
  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [userFoods, setUserFoods] = useState<FoodItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchUserFoods();
  }, []);

  const fetchUserFoods = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Fetch custom foods created by the user
      const customFoodsRef = collection(db, 'customFoods');
      const customFoodsQuery = query(customFoodsRef, where('userId', '==', user.uid));
      const customFoodsSnapshot = await getDocs(customFoodsQuery);
      
      // Fetch meals the user has logged
      const mealsRef = collection(db, 'meals');
      const mealsQuery = query(mealsRef, where('userId', '==', user.uid));
      const mealsSnapshot = await getDocs(mealsQuery);

      // Combine and format data
      const customFoodsData = customFoodsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        brand: doc.data().brand || 'Custom',
        calories: doc.data().calories,
        protein: doc.data().protein,
        carbs: doc.data().carbs,
        fat: doc.data().fat,
        servingSize: doc.data().servingSize,
        servingUnit: doc.data().servingUnit,
        imageUrl: doc.data().imageUrl,
        isCustom: true,
        quantity: 1,
      }));

      const mealsData = mealsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        brand: doc.data().brand_name || '',
        calories: doc.data().calories,
        protein: doc.data().protein,
        carbs: doc.data().carbs,
        fat: doc.data().fats,
        imageUrl: doc.data().image_url,
        isCustom: false,
        quantity: 1,
      }));

      // Remove duplicates by name and sort alphabetically
      const allFoods = [...customFoodsData, ...mealsData];
      const uniqueNames = new Set<string>();
      const uniqueFoods = allFoods.filter(food => {
        const key = `${food.name}-${food.brand}`;
        if (uniqueNames.has(key)) return false;
        uniqueNames.add(key);
        return true;
      });

      setUserFoods(uniqueFoods.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error fetching foods:', error);
    }
  };

  const handleChange = (field: keyof CustomMeal, value: string) => {
    setCustomMeal(prev => ({ ...prev, [field]: value }));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const addFoodToMeal = (food: FoodItem) => {
    setCustomMeal(prev => ({
      ...prev,
      foods: [...prev.foods, food]
    }));
    setSearchModalVisible(false);
  };

  const removeFoodFromMeal = (index: number) => {
    setCustomMeal(prev => ({
      ...prev,
      foods: prev.foods.filter((_, i) => i !== index)
    }));
  };

  const updateFoodQuantity = (index: number, quantity: number) => {
    if (quantity < 0.1) quantity = 0.1;
    
    const updatedFoods = [...customMeal.foods];
    updatedFoods[index] = { ...updatedFoods[index], quantity };
    
    setCustomMeal(prev => ({
      ...prev,
      foods: updatedFoods
    }));
  };

  const calculateTotalMacros = () => {
    return customMeal.foods.reduce((total, food) => ({
      calories: total.calories + (food.calories * food.quantity),
      protein: total.protein + (food.protein * food.quantity),
      carbs: total.carbs + (food.carbs * food.quantity),
      fat: total.fat + (food.fat * food.quantity),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const handleSave = async () => {
    if (!customMeal.name) {
      Alert.alert('Required Field', 'Please enter a name for your meal.');
      return;
    }

    if (customMeal.foods.length === 0) {
      Alert.alert('Required Field', 'Please add at least one food item to your meal.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save a custom meal.');
      return;
    }

    setIsUploading(true);

    try {
      // Upload image if selected
      let imageUrl: string | undefined = undefined;
      if (image) {
        const response = await fetch(image);
        const blob = await response.blob();
        const storageRef = ref(storage, `meal_images/${user.uid}/${Date.now()}`);
        await uploadBytes(storageRef, blob);
        imageUrl = await getDownloadURL(storageRef);
      }

      // Calculate total macros
      const totalMacros = calculateTotalMacros();

      // Add to custom meals collection
      await addDoc(collection(db, 'customMeals'), {
        userId: user.uid,
        name: customMeal.name,
        description: customMeal.description || '',
        calories: totalMacros.calories,
        protein: totalMacros.protein,
        carbs: totalMacros.carbs,
        fats: totalMacros.fat,
        foods: customMeal.foods.map(food => ({
          id: food.id,
          name: food.name,
          brand: food.brand || '',
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          quantity: food.quantity,
          isCustom: food.isCustom || false,
        })),
        imageUrl,
        timestamp: Timestamp.now(),
        isCustomMeal: true,
      });

      Alert.alert(
        'Success', 
        'Custom meal created successfully!',
        [{ text: 'OK', onPress: () => router.push('/(tabs)') }]
      );
    } catch (error) {
      console.error('Error saving custom meal:', error);
      Alert.alert('Error', 'Failed to save custom meal. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredFoods = userFoods.filter(food => 
    food.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (food.brand && food.brand.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalMacros = calculateTotalMacros();

  const renderFoodItem = ({ item, index }: { item: FoodItem, index: number }) => (
    <View style={styles.selectedFoodItem}>
      <View style={styles.foodItemContent}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.foodItemImage} />
        ) : (
          <View style={[styles.foodItemImage, styles.foodItemPlaceholder]}>
            <FontAwesome name="cutlery" size={18} color="#ccc" />
          </View>
        )}
        <View style={styles.foodItemInfo}>
          <Text style={styles.foodItemName}>{item.name}</Text>
          <Text style={styles.foodItemBrand}>{item.brand || 'Generic'}</Text>
          <Text style={styles.foodItemMacros}>
            Cal: {Math.round(item.calories * item.quantity)} • 
            P: {Math.round(item.protein * item.quantity)}g • 
            C: {Math.round(item.carbs * item.quantity)}g • 
            F: {Math.round(item.fat * item.quantity)}g
          </Text>
        </View>
      </View>
      
      <View style={styles.quantityContainer}>
        <TouchableOpacity 
          onPress={() => updateFoodQuantity(index, item.quantity - 0.5)}
          style={styles.quantityButton}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        
        <Text style={styles.quantityValue}>{item.quantity.toFixed(1)}x</Text>
        
        <TouchableOpacity 
          onPress={() => updateFoodQuantity(index, item.quantity + 0.5)}
          style={styles.quantityButton}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => removeFoodFromMeal(index)}
          style={styles.removeButton}
        >
          <FontAwesome name="times" size={16} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchResultItem = ({ item }: { item: FoodItem }) => (
    <TouchableOpacity 
      style={styles.searchResultItem}
      onPress={() => addFoodToMeal(item)}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.searchResultImage} />
      ) : (
        <View style={[styles.searchResultImage, styles.searchResultPlaceholder]}>
          <FontAwesome name="cutlery" size={18} color="#ccc" />
        </View>
      )}
      <View style={styles.searchResultInfo}>
        <Text style={styles.searchResultName}>{item.name}</Text>
        <Text style={styles.searchResultBrand}>{item.brand || 'Generic'}</Text>
        <Text style={styles.searchResultMacros}>
          Cal: {item.calories} • P: {item.protein}g • C: {item.carbs}g • F: {item.fat}g
        </Text>
      </View>
      <FontAwesome name="plus-circle" size={24} color="#31256C" style={styles.addIcon} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <FontAwesome name="chevron-left" size={24} color="#31256C" />
            </TouchableOpacity>
            <Text style={styles.title}>Create Custom Meal</Text>
            <View style={{width: 24}}></View>
          </View>

          <TouchableOpacity style={styles.imageContainer} onPress={pickImage}>
            {image ? (
              <Image 
                source={{ uri: image }} 
                style={styles.mealImage} 
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <FontAwesome name="camera" size={40} color="#ccc" />
                <Text style={styles.imagePlaceholderText}>Add Meal Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Meal Name *</Text>
              <TextInput
                style={styles.input}
                value={customMeal.name}
                onChangeText={(value) => handleChange('name', value)}
                placeholder="e.g. Protein Breakfast Bowl"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={customMeal.description}
                onChangeText={(value) => handleChange('description', value)}
                placeholder="Describe your meal"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Food Items</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                fetchUserFoods(); // Refresh the list when opening
                setSearchModalVisible(true);
              }}
            >
              <Text style={styles.addButtonText}>Add Food</Text>
              <FontAwesome name="plus" size={16} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          {customMeal.foods.length === 0 ? (
            <View style={styles.emptyState}>
              <FontAwesome name="cutlery" size={40} color="#ccc" />
              <Text style={styles.emptyStateText}>No food items added yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add foods to create your custom meal
              </Text>
            </View>
          ) : (
            <>
              {customMeal.foods.map((food, index) => (
                renderFoodItem({ item: food, index })
              ))}
              
              <View style={styles.totalMacrosContainer}>
                <Text style={styles.totalMacrosTitle}>Total Nutrition</Text>
                <View style={styles.totalMacrosContent}>
                  <Text style={styles.totalMacrosCalories}>
                    {Math.round(totalMacros.calories)} Calories
                  </Text>
                  <Text style={styles.totalMacrosDetail}>
                    Protein: {Math.round(totalMacros.protein)}g • 
                    Carbs: {Math.round(totalMacros.carbs)}g • 
                    Fat: {Math.round(totalMacros.fat)}g
                  </Text>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity 
            style={[styles.saveButton, isUploading && styles.disabledButton]} 
            onPress={handleSave}
            disabled={isUploading || customMeal.foods.length === 0}
          >
            <Text style={styles.saveButtonText}>
              {isUploading ? 'Saving...' : 'Save Custom Meal'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Search Modal */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Food Items</Text>
              <TouchableOpacity 
                onPress={() => setSearchModalVisible(false)}
                style={styles.closeButton}
              >
                <FontAwesome name="times" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your foods..."
              clearButtonMode="while-editing"
            />

            <TouchableOpacity
              style={styles.createFoodButton}
              onPress={() => {
                setSearchModalVisible(false);
                router.push('/CreateFoodScreen');
              }}
            >
              <FontAwesome name="plus-circle" size={18} color="#31256C" style={{ marginRight: 8 }} />
              <Text style={styles.createFoodButtonText}>Create New Food Item</Text>
            </TouchableOpacity>

            {filteredFoods.length > 0 ? (
              <FlatList
                data={filteredFoods}
                renderItem={renderSearchResultItem}
                keyExtractor={(item, index) => `${item.id || item.name}-${index}`}
                style={styles.searchResultsList}
              />
            ) : (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>
                  No foods found. Try creating a new custom food.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#31256C',
    textAlign: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mealImage: {
    width: '100%',
    height: 200,
    borderRadius: 15,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
  },
  imagePlaceholderText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#31256C',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#31256C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 40,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  selectedFoodItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  foodItemContent: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  foodItemImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  foodItemPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodItemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  foodItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  foodItemBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  foodItemMacros: {
    fontSize: 14,
    color: '#31256C',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginTop: 5,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    color: '#31256C',
    fontWeight: 'bold',
  },
  quantityValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginHorizontal: 12,
    width: 40,
    textAlign: 'center',
  },
  removeButton: {
    marginLeft: 15,
    padding: 8,
  },
  totalMacrosContainer: {
    backgroundColor: '#31256C',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  totalMacrosTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  totalMacrosContent: {
    alignItems: 'center',
  },
  totalMacrosCalories: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  totalMacrosDetail: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  saveButton: {
    backgroundColor: '#31256C',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#31256C',
  },
  closeButton: {
    padding: 5,
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  createFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    marginBottom: 15,
  },
  createFoodButtonText: {
    fontSize: 16,
    color: '#31256C',
    fontWeight: '600',
  },
  searchResultsList: {
    maxHeight: '70%',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  searchResultImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  searchResultPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  searchResultMacros: {
    fontSize: 14,
    color: '#31256C',
  },
  addIcon: {
    marginLeft: 15,
  },
  emptySearch: {
    alignItems: 'center',
    padding: 40,
  },
  emptySearchText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});