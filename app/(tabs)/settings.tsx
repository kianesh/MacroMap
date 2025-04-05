import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { auth, db } from '../../FirebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { useRouter } from 'expo-router';

export default function Settings() {
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');
  const router = useRouter();

  // Load saved preferences when component mounts
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedWeightUnit = await AsyncStorage.getItem('weightUnit');
        const savedHeightUnit = await AsyncStorage.getItem('heightUnit');
        
        if (savedWeightUnit) setWeightUnit(savedWeightUnit);
        if (savedHeightUnit) setHeightUnit(savedHeightUnit);
      } catch (error) {
        console.error('Failed to load preferences', error);
      }
    };
    
    loadPreferences();
  }, []);

  // Save preferences when they change
  const savePreference = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to save ${key}`, error);
    }
  };

  const handleWeightUnitChange = (value: string) => {
    setWeightUnit(value);
    savePreference('weightUnit', value);
  };

  const handleHeightUnitChange = (value: string) => {
    setHeightUnit(value);
    savePreference('heightUnit', value);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const user = auth.currentUser;
            if (user) {
              try {
                // Delete user data from Firestore
                const userRef = doc(db, 'users', user.uid);
                await deleteDoc(userRef);

                // Delete user from Firebase Authentication
                await deleteUser(user);

                Alert.alert('Success', 'Account deleted successfully.');
                router.replace('/');
              } catch (error) {
                console.error('Error deleting account:', error);
                Alert.alert('Error', 'Failed to delete account. Please try again.');
              }
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Settings</Text>

      {/* Weight Unit Picker */}
      <View style={styles.settingItem}>
        <Text style={styles.label}>Weight Unit</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={weightUnit}
            onValueChange={handleWeightUnitChange}
            style={styles.picker}
          >
            <Picker.Item label="Kilograms (kg)" value="kg" />
            <Picker.Item label="Pounds (lbs)" value="lbs" />
          </Picker>
        </View>
      </View>

      {/* Height Unit Picker */}
      <View style={styles.settingItem}>
        <Text style={styles.label}>Height Unit</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={heightUnit}
            onValueChange={handleHeightUnitChange}
            style={styles.picker}
          >
            <Picker.Item label="Centimeters (cm)" value="cm" />
            <Picker.Item label="Feet/Inches (ft/in)" value="ft/in" />
          </Picker>
        </View>
      </View>

      {/* Delete Account Button - moved up from bottom to be visible */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>
      
      {/* Add space at bottom to ensure delete button is visible above navbar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#31256C',
  },
  settingItem: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    color: '#3C4858',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});