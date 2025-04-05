import { FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usePathname, useRouter } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db, storage } from '../FirebaseConfig';

interface UserData {
  name: string;
  email: string;
  age?: number;
  weight?: number;
  height?: number;
  gender?: string;
  activityLevel?: string;
  goal?: string;
  protein?: number;
  fats?: number;
  carbs?: number;
  calorieGoal?: number;
  profilePictureUrl?: string;
}

export default function ProfileScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Fetch user data from Firestore
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userData = (await getDoc(userRef)).data() as UserData | undefined;
        if (userData) {
          setUserData(userData);
        }
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user && pathname !== '/') {
        router.replace('/'); // Redirect to login page if user is not logged in
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/'); // Redirect to login page
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        // Delete user data from Firestore
        const userRef = doc(db, 'users', user.uid);
        await deleteDoc(userRef);

        // Delete user from Firebase Authentication
        await deleteUser(user);

        alert('Account deleted successfully.');
        router.replace('/'); // Redirect to home or login page
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Failed to delete account. Please try again.');
      }
    }
  };

  const handleProfilePictureUpload = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets?.[0]) {
        // Show loading state
        setIsUploading(true);
        
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        
        const storageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(storageRef, blob);
        
        const downloadURL = await getDownloadURL(storageRef);
        
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { profilePictureUrl: downloadURL });
        
        setUserData(prev => prev ? { ...prev, profilePictureUrl: downloadURL } : null);
        setIsUploading(false);
        
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="chevron-left" size={24} color="#31256C" />
          </TouchableOpacity>
          <View style={{flex: 1}} />
        </View>

        <View style={styles.profileSection}>
          <TouchableOpacity 
            onPress={handleProfilePictureUpload} 
            style={styles.profileImageContainer}
          >
            {userData?.profilePictureUrl ? (
              <>
                <Image source={{ uri: userData.profilePictureUrl }} style={styles.profileImage} />
                <View style={styles.editOverlay}>
                  <FontAwesome name="camera" size={18} color="#FFFFFF" />
                </View>
              </>
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <FontAwesome name="camera" size={24} color="#999" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{userData?.name}</Text>
          <Text style={styles.email}>{userData?.email}</Text>
        </View>

        <TouchableOpacity 
          style={styles.meButton} 
          onPress={() => router.push('/about')}
        >
          <Text style={styles.meButtonText}>Me</Text>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={styles.statsBox}>
              <Text style={styles.statsLabel}>Calorie</Text>
              <Text style={styles.statsValue}>{userData?.calorieGoal} Cal</Text>
            </View>
            <View style={styles.statsBox}>
              <Text style={styles.statsLabel}>Protein</Text>
              <Text style={styles.statsValue}>{userData?.protein} g</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statsBox}>
              <Text style={styles.statsLabel}>Fats</Text>
              <Text style={styles.statsValue}>{userData?.fats} g</Text>
            </View>
            <View style={styles.statsBox}>
              <Text style={styles.statsLabel}>Carbs</Text>
              <Text style={styles.statsValue}>{userData?.carbs} g</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuItems}>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Contact us</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>About app</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/(tabs)/settings')}
          >
            <Text style={styles.menuItemText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
            <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  backButton: {
    fontSize: 24,
    marginRight: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#31256C',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoText: {
    color: '#31256C',
    fontSize: 16,
    marginTop: 5,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666666',
  },
  meButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#31256C',
    margin: 20,
    padding: 15,
    borderRadius: 10,
  },
  meButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
  },
  chevron: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  statsGrid: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statsBox: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    marginHorizontal: 5,
  },
  statsLabel: {
    fontSize: 16,
    color: '#666666',
  },
  statsValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 5,
  },
  menuItems: {
    padding: 20,
  },
  menuItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#31256C',
  },
  logoutText: {
    color: '#FF3B30',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
});
