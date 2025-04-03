import * as ImagePicker from 'expo-image-picker';
import { usePathname, useRouter } from 'expo-router';
import { deleteUser, signOut } from 'firebase/auth';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
        // Show loading state if you want
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        
        // Create a reference to the storage location
        const storageRef = ref(storage, `profilePictures/${user.uid}`);
        
        // Upload the image
        await uploadBytes(storageRef, blob);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        
        // Update Firestore with the profile picture URL
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { profilePictureUrl: downloadURL });
        
        // Update local state
        setUserData(prev => prev ? { ...prev, profilePictureUrl: downloadURL } : null);
        
        // Optional: Show success message
        alert('Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to update profile picture. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          {userData?.profilePictureUrl ? (
            <Image source={{ uri: userData.profilePictureUrl }} style={styles.profileImage} />
          ) : (
            <TouchableOpacity onPress={handleProfilePictureUpload} style={styles.profileImagePlaceholder}>
              <Text>Add Photo</Text>
            </TouchableOpacity>
          )}
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
          <TouchableOpacity style={styles.menuItem}>
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
