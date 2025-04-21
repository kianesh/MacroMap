import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState, useCallback } from 'react'; // Added useCallback
import {
  Alert,
  Animated,
  Dimensions,
  Modal, // Added Modal
  PanResponder,
  StyleSheet,
  Text,
  TextInput, // Added TextInput
  TouchableOpacity,
  View,
  Keyboard // Added Keyboard
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons'; // Added FontAwesome for edit icon
import { auth, db } from '../FirebaseConfig';

// Constants for the ruler
const RULER_HEIGHT = 150;
const TICK_WIDTH = 2;
const TICK_HEIGHT = 20;
const LARGE_TICK_HEIGHT = 40;
const RULER_WIDTH = Dimensions.get('window').width * 20; // Keep it wide for spacing
const CENTER_POINT = Dimensions.get('window').width / 2;
const TICK_INTERVAL = 50; // Spacing between ticks representing 1 unit (e.g., 1kg or 1lb)
const SUBDIVISIONS = 10; // Number of subdivisions per unit (for 0.1 precision)
const STEP_WIDTH = TICK_INTERVAL / SUBDIVISIONS; // Width of each 0.1 step

export default function LogWeightScreen() {
  const [weight, setWeight] = useState(70.0); // Use float for precision
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [lastUnit, setLastUnit] = useState<'kg' | 'lb'>('kg');
  const [modalVisible, setModalVisible] = useState(false); // State for modal
  const [manualWeight, setManualWeight] = useState(''); // State for manual input
  const router = useRouter();
  const panX = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);

  // Load custom font
  const [fontLoaded] = useFonts({
    'AfacadFlux': require('../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  // --- Helper Functions ---
  const getMinWeight = useCallback(() => (unit === 'kg' ? 30 : 66), [unit]);
  const getMaxWeight = useCallback(() => (unit === 'kg' ? 200 : 440), [unit]);

  // Calculate the offset for a given weight
  const calculateOffsetForWeight = useCallback((targetWeight: number) => {
    const startVal = getMinWeight();
    // Calculate the number of 0.1 steps from the start
    const stepsFromStart = (targetWeight - startVal) * SUBDIVISIONS;
    return -(stepsFromStart * STEP_WIDTH);
  }, [unit, getMinWeight]);

  // Calculate the weight for a given offset
  const calculateWeightForOffset = useCallback((currentOffset: number) => {
    const startVal = getMinWeight();
    // Calculate the number of 0.1 steps based on offset
    const stepsFromStart = -currentOffset / STEP_WIDTH;
    const calculatedWeight = startVal + stepsFromStart / SUBDIVISIONS;
    // Clamp within min/max range and round
    const clampedWeight = Math.max(getMinWeight(), Math.min(getMaxWeight(), calculatedWeight));
    return Math.round(clampedWeight * SUBDIVISIONS) / SUBDIVISIONS;
  }, [unit, getMinWeight, getMaxWeight]);

  // --- Effects ---

  // Initialize or update ruler position when unit changes or font loads
  useEffect(() => {
    if (!fontLoaded) return;

    let newWeight = weight;
    // Convert weight when unit changes
    if (unit === 'lb' && lastUnit === 'kg') {
      newWeight = Math.round(weight * 2.20462 * SUBDIVISIONS) / SUBDIVISIONS;
    } else if (unit === 'kg' && lastUnit === 'lb') {
      newWeight = Math.round(weight / 2.20462 * SUBDIVISIONS) / SUBDIVISIONS;
    }

    // Clamp the converted weight
    const clampedWeight = Math.max(getMinWeight(), Math.min(getMaxWeight(), newWeight));
    setWeight(clampedWeight); // Update state with potentially converted and clamped weight

    // Calculate and set the initial offset based on the *final* weight
    const initialOffset = calculateOffsetForWeight(clampedWeight);
    panX.setValue(initialOffset);
    lastOffset.current = initialOffset;

    setLastUnit(unit); // Update lastUnit *after* conversion
  }, [unit, fontLoaded, calculateOffsetForWeight, getMinWeight, getMaxWeight]); // Removed weight dependency here

  // Update ruler position when weight is changed *manually* (e.g., via modal)
  // This effect should ONLY run when the weight state changes externally, not during panning
  const isPanning = useRef(false); // Ref to track panning state
  useEffect(() => {
    if (!isPanning.current) { // Only update if not currently panning
        const targetOffset = calculateOffsetForWeight(weight);
        // Use Animated.timing for a smooth transition if desired, or setValue for immediate jump
        // Animated.timing(panX, { toValue: targetOffset, duration: 100, useNativeDriver: false }).start();
        panX.setValue(targetOffset);
        lastOffset.current = targetOffset;
    }
  }, [weight, calculateOffsetForWeight]); // Depends only on weight and the calculation function


  // --- Pan Responder ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        isPanning.current = true; // Start panning
        panX.setOffset(lastOffset.current); // Apply the last offset
        panX.setValue(0); // Reset the current value to 0 for delta tracking
      },
      onPanResponderMove: (_, gestureState) => {
        // Calculate the *potential* new offset
        const currentGestureOffset = lastOffset.current + gestureState.dx;
        // Calculate the weight corresponding to this potential offset
        const newWeight = calculateWeightForOffset(currentGestureOffset);

        // Update the visual position of the ruler directly
        panX.setValue(gestureState.dx);

        // Update the displayed weight state if it changed
        if (newWeight !== weight) {
          setWeight(newWeight); // Update state to reflect calculated weight

          // Haptic feedback logic (optional, keep if desired)
          const wholePart = Math.floor(newWeight);
          const prevWholePart = Math.floor(weight); // Compare with previous state
          if (wholePart !== prevWholePart) {
             Haptics.impactAsync(
               wholePart % 5 === 0 ?
                 Haptics.ImpactFeedbackStyle.Heavy :
                 Haptics.ImpactFeedbackStyle.Medium
             );
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        panX.flattenOffset(); // Merge offset into value
        const finalOffset = lastOffset.current + gestureState.dx;
        const finalWeight = calculateWeightForOffset(finalOffset);

        // Snap to the final calculated weight's precise offset
        const targetOffset = calculateOffsetForWeight(finalWeight);
        lastOffset.current = targetOffset; // Update the stored offset

        // Animate to the snapped position
        Animated.spring(panX, {
          toValue: targetOffset,
          useNativeDriver: false, // Required for layout animations like translateX
        }).start(() => {
            isPanning.current = false; // End panning after animation
        });

        setWeight(finalWeight); // Ensure state matches final snapped weight

        // Final feedback (optional)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
       onPanResponderTerminate: () => { // Handle interruption
        isPanning.current = false;
        // Optionally snap back or handle termination state
       }
    })
  ).current;

  // --- Ruler Rendering ---
  const renderRuler = () => {
    const ticks: React.ReactNode[] = [];
    const startVal = getMinWeight();
    const endVal = getMaxWeight();

    // Iterate through 0.1 steps
    for (let val = startVal; val <= endVal; val += 1 / SUBDIVISIONS) {
      const currentVal = Math.round(val * SUBDIVISIONS) / SUBDIVISIONS; // Ensure precision
      const stepsFromStart = (currentVal - startVal) * SUBDIVISIONS;
      const tickPosition = stepsFromStart * STEP_WIDTH;

      const isLargeTick = Math.abs(currentVal % 10) < 0.01 || Math.abs(currentVal % 10 - 10) < 0.01; // Every 10 units
      const isMediumTick = Math.abs(currentVal % 5) < 0.01 || Math.abs(currentVal % 5 - 5) < 0.01; // Every 5 units
      const isSmallTick = Math.abs(currentVal % 1) < 0.01 || Math.abs(currentVal % 1 - 1) < 0.01; // Every 1 unit

      let tickHeight = TICK_HEIGHT * 0.3; // Default smallest tick
      let tickWidth = TICK_WIDTH;
      if (isSmallTick) tickHeight = TICK_HEIGHT * 0.6;
      if (isMediumTick) tickHeight = TICK_HEIGHT * 0.85;
      if (isLargeTick) {
          tickHeight = LARGE_TICK_HEIGHT;
          tickWidth = 3;
      }


      ticks.push(
        <View
          key={`tick-${currentVal}`}
          style={[
            styles.tick,
            {
              height: tickHeight,
              left: tickPosition,
              width: tickWidth,
            },
          ]}
        />
      );

      // Add text label only for large ticks (every 10 units)
      if (isLargeTick) {
        ticks.push(
          <Text
            key={`text-${currentVal}`}
            style={[
              styles.tickText,
              // Center the text label over the tick
              { left: tickPosition - (styles.tickText.width / 2) }
            ]}
          >
            {Math.round(currentVal)}
          </Text>
        );
      }
    }
    return ticks;
  };

  // --- Event Handlers ---

  // Toggle between kg and lb
  const toggleUnit = (newUnit: 'kg' | 'lb') => {
    if (newUnit !== unit) {
      setUnit(newUnit);
    }
  };

  // Handle manual weight input completion
  const handleWeightInputComplete = () => {
    Keyboard.dismiss(); // Dismiss keyboard
    const numValue = parseFloat(manualWeight.replace(',', '.')); // Allow comma as decimal separator

    if (!isNaN(numValue)) {
      const minWeight = getMinWeight();
      const maxWeight = getMaxWeight();
      // Clamp and round
      let validWeight = Math.max(minWeight, Math.min(maxWeight, numValue));
      validWeight = Math.round(validWeight * SUBDIVISIONS) / SUBDIVISIONS;

      setWeight(validWeight); // Update the main weight state
    }
    setModalVisible(false); // Close modal
  };

  // Open the manual input modal
  const openWeightModal = () => {
    setManualWeight(weight.toFixed(1)); // Pre-fill with current weight
    setModalVisible(true);
  };

  // --- Save Logic (remains largely the same) ---
  const saveWeight = async () => {
    // ... (keep existing saveWeight logic) ...
     const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save weight');
      return;
    }

    try {
      // Convert weight to kg if needed before saving
      const weightInKg = unit === 'lb' ? weight / 2.20462 : weight;

      // Save to weight tracking collection
      await addDoc(collection(db, 'weights'), {
        userId: user.uid,
        weight: weightInKg, // Save in kg
        date: Timestamp.now()
      });

      // Update user profile (optional, if you store current weight there)
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { weight: weightInKg }, { merge: true });

      // Recalculate nutrition goals (if needed)
      // await updateUserNutritionGoals(user.uid, weightInKg); // Uncomment if you have this function

      Alert.alert(
        'Success',
        'Weight logged successfully',
        [{ text: 'OK', onPress: () => router.back() }] // Go back after saving
      );
    } catch (error) {
      console.error('Error logging weight:', error);
      Alert.alert('Error', 'Failed to log weight');
    }
  };

  // --- Render ---
  if (!fontLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log Your Weight</Text>

      {/* Touchable Weight Display */}
      <TouchableOpacity
        style={styles.weightDisplayContainer}
        onPress={openWeightModal} // Open modal on press
        activeOpacity={0.7}
      >
        <Text style={styles.weightValue}>{weight.toFixed(1)}</Text>
        <Text style={styles.weightUnit}>{unit}</Text>
        <FontAwesome name="pencil" size={16} color="#666" style={styles.editIcon} />
      </TouchableOpacity>

      {/* Ruler */}
      <View style={styles.rulerContainer}>
        <View style={styles.centerLine} />
        <Animated.View
          style={[
            styles.rulerContent,
            { transform: [{ translateX: panX }] }
          ]}
          {...panResponder.panHandlers}
        >
          {renderRuler()}
        </Animated.View>
      </View>

      {/* Unit Toggle */}
      <View style={styles.unitToggleContainer}>
        <TouchableOpacity
          style={[styles.unitButton, unit === 'kg' && styles.activeUnitButton]}
          onPress={() => toggleUnit('kg')}
        >
          <Text style={[styles.unitButtonText, unit === 'kg' && styles.activeUnitButtonText]}>kg</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitButton, unit === 'lb' && styles.activeUnitButton]}
          onPress={() => toggleUnit('lb')}
        >
          <Text style={[styles.unitButtonText, unit === 'lb' && styles.activeUnitButtonText]}>lb</Text>
        </TouchableOpacity>
      </View>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={saveWeight}>
        <Text style={styles.saveButtonText}>Save Weight</Text>
      </TouchableOpacity>

      {/* Manual Input Modal */}
      <Modal
        animationType="fade" // Use fade for less intrusion
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity // Allow dismissing by tapping outside
          style={styles.centeredView}
          activeOpacity={1}
          onPressOut={() => setModalVisible(false)}
        >
          <TouchableOpacity // Prevent dismissal when tapping inside modal content
             activeOpacity={1}
             onPress={(e) => e.stopPropagation()} // Stop propagation
          >
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Enter Weight ({unit})</Text>
              <TextInput
                style={styles.weightInput}
                value={manualWeight}
                onChangeText={setManualWeight}
                keyboardType="numeric" // Use numeric for better input
                autoFocus
                selectTextOnFocus
                placeholder={`Weight in ${unit}`}
                onSubmitEditing={handleWeightInputComplete} // Allow submitting with keyboard 'done'
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleWeightInputComplete}
                >
                  <Text style={[styles.modalButtonText, styles.confirmButtonText]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// --- Styles (Add modal styles and update existing ones) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center', // Center content vertically
  },
  loadingContainer: { // Added for loading state
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: { // Added for loading state
    fontSize: 18,
    color: '#31256C',
    fontFamily: 'AfacadFlux',
  },
  title: {
    fontSize: 28, // Slightly larger title
    fontWeight: '600', // Bolder
    color: '#31256C',
    marginBottom: 40,
    fontFamily: 'AfacadFlux',
  },
  weightDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align text baselines
    marginBottom: 50,
    padding: 10, // Add padding to make touch target larger
  },
  weightValue: {
    fontSize: 72, // Larger weight display
    fontWeight: 'bold',
    color: '#31256C',
    fontFamily: 'AfacadFlux',
    lineHeight: 72, // Match font size for better alignment
  },
  weightUnit: {
    fontSize: 28, // Larger unit
    fontWeight: '600',
    color: '#666',
    marginBottom: 10, // Adjust vertical alignment
    marginLeft: 8,
    fontFamily: 'AfacadFlux',
  },
  editIcon: {
    marginBottom: 15, // Adjust vertical alignment
    marginLeft: 10,
  },
  rulerContainer: {
    height: RULER_HEIGHT,
    width: Dimensions.get('window').width, // Full width
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 50,
    // Optional: Add subtle gradient or shadow for depth
  },
  centerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3, // Slightly thicker line
    backgroundColor: '#E53935', // Use a distinct color (e.g., red)
    left: CENTER_POINT - 1.5, // Center the line precisely
    zIndex: 10,
    borderRadius: 1.5,
  },
  rulerContent: {
    position: 'absolute',
    height: RULER_HEIGHT,
    width: RULER_WIDTH,
    // The Animated.View handles positioning via transform
  },
  tick: {
    position: 'absolute',
    backgroundColor: '#9E9E9E', // Slightly darker ticks
    bottom: 0,
    borderRadius: 1, // Slightly rounded ticks
  },
  tickText: {
    position: 'absolute',
    color: '#424242', // Darker text
    fontSize: 16, // Adjust size as needed
    fontWeight: '500',
    bottom: LARGE_TICK_HEIGHT + 10, // Position above the tallest tick
    width: 50, // Give text more space
    textAlign: 'center',
    fontFamily: 'AfacadFlux',
  },
  unitToggleContainer: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  unitButton: {
    paddingVertical: 12,
    paddingHorizontal: 35, // More horizontal padding
    borderRadius: 25,
    backgroundColor: '#EEEEEE', // Lighter inactive background
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeUnitButton: {
    backgroundColor: '#31256C',
    borderColor: '#31256C',
  },
  unitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#616161', // Darker inactive text
    fontFamily: 'AfacadFlux',
  },
  activeUnitButtonText: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#31256C',
    paddingVertical: 16, // Slightly taller button
    paddingHorizontal: 30,
    borderRadius: 30, // More rounded
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%', // Responsive width
    minWidth: 200, // Minimum width
    elevation: 3, // Add shadow for Android
    shadowColor: '#000', // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
  },
  // --- Modal Styles ---
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay
  },
  modalView: {
    width: '85%', // Slightly wider modal
    maxWidth: 350, // Max width for larger screens
    backgroundColor: "white",
    borderRadius: 15, // More rounded corners
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: '#31256C',
    marginBottom: 25, // More space below title
    fontFamily: 'AfacadFlux',
  },
  weightInput: {
    width: '100%',
    height: 55, // Taller input
    borderWidth: 1.5, // Slightly thicker border
    borderColor: '#BDBDBD', // Grey border
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 30, // More space below input
    fontSize: 20, // Larger font size in input
    textAlign: 'center', // Center the text
    fontFamily: 'AfacadFlux',
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Space out buttons
    width: '100%',
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1, // Make buttons take equal space
    marginHorizontal: 8, // Add space between buttons
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5', // Lighter cancel button
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  confirmButton: {
    backgroundColor: '#31256C',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'AfacadFlux',
    color: '#424242', // Darker text for cancel
  },
  confirmButtonText: {
    color: '#FFFFFF',
  },
});