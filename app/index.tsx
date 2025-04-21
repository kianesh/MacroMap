import { Link, router } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { auth } from '../FirebaseConfig';

SplashScreen.preventAutoHideAsync();

const index = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loaded, error] = useFonts({
    'AfacadFlux': require('../assets/fonts/AfacadFlux-VariableFont_slnt,wght.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/(tabs)');
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const user = await signInWithEmailAndPassword(auth, email, password);
      if (user) router.replace('/(tabs)');
    } catch (error: any) {
      console.log(error);
      alert('Sign in failed: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Image source={require('../assets/images/Logo_Index.png')} style={styles.logo} />
      <TextInput style={styles.textInput} placeholder="email" value={email} onChangeText={setEmail} />
      <TextInput style={styles.textInput} placeholder="password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={signIn}>
        <Text style={styles.text}>Login</Text>
      </TouchableOpacity>
      <Link href="/RegisterScreen" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.text}>Register</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/ResetScreen" asChild>
        <TouchableOpacity>
          <Text style={styles.linkText}>Reset Password?</Text>
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
};

export default index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'AfacadFlux',
    backgroundColor: '#FAFAFA', // A softer white for a modern, minimalist background
  },
  logo: {
    width: '30%',
    height: '30%'
  },
  title: {
    fontSize: 28, // A bit larger for a more striking appearance
    fontWeight: '800', // Extra bold for emphasis
    marginBottom: 40, // Increased space for a more airy, open feel
    color: '#1A237E', // A deep indigo for a sophisticated, modern look
    fontFamily: 'AfacadFlux',
  },
  textInput: {
    height: 50, // Standard height for elegance and simplicity
    width: '90%', // Full width for a more expansive feel
    backgroundColor: '#FFFFFF', // Pure white for contrast against the container
    borderColor: '#E8EAF6', // A very light indigo border for subtle contrast
    borderWidth: 2,
    borderRadius: 15, // Softly rounded corners for a modern, friendly touch
    marginVertical: 15,
    paddingHorizontal: 25, // Generous padding for ease of text entry
    fontSize: 16, // Comfortable reading size
    color: '#3C4858', // A dark gray for readability with a hint of warmth
    shadowColor: '#9E9E9E', // A medium gray shadow for depth
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4, // Slightly elevated for a subtle 3D effect
    fontFamily: 'AfacadFlux',
  },
  button: {
    width: '90%',
    marginVertical: 15,
    backgroundColor: '#31256C', // A lighter indigo to complement the title color
    padding: 20,
    borderRadius: 15, // Matching rounded corners for consistency
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    fontFamily: 'AfacadFlux',
  },
  text: {
    color: '#FFFFFF', // Maintained white for clear visibility
    fontSize: 18, // Slightly larger for emphasis
    fontWeight: '600', // Semi-bold for a balanced weight
    fontFamily: 'AfacadFlux',
  },
  linkText: {
    color: '#31256C', // Deep indigo for a link-like appearance
    fontSize: 16,
    marginTop: 20,
    fontFamily: 'AfacadFlux',
  },
});