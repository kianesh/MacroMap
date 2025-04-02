import { Picker } from '@react-native-picker/picker';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Settings() {
  const [weightUnit, setWeightUnit] = useState('kg');
  const [heightUnit, setHeightUnit] = useState('cm');

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Add your account deletion logic here
            console.log('Account deleted');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* Weight Unit Picker */}
      <View style={styles.settingItem}>
        <Text style={styles.label}>Weight Unit</Text>
        <Picker
          selectedValue={weightUnit}
          onValueChange={(itemValue: string) => setWeightUnit(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Kilograms (kg)" value="kg" />
          <Picker.Item label="Pounds (lbs)" value="lbs" />
        </Picker>
      </View>

      {/* Height Unit Picker */}
      <View style={styles.settingItem}>
        <Text style={styles.label}>Height Unit</Text>
        <Picker
          selectedValue={heightUnit}
          onValueChange={(itemValue: string) => setHeightUnit(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Centimeters (cm)" value="cm" />
          <Picker.Item label="Feet/Inches (ft/in)" value="ft/in" />
        </Picker>
      </View>

      {/* Delete Account Button */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#31256C',
    textAlign: 'center',
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
  picker: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 1,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
  },
  deleteButton: {
    marginTop: 'auto',
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});