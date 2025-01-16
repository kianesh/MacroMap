import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '@/FirebaseConfig';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  const resetPassword = async () => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent!');
      router.replace('/');
    } catch (error: any) {
      console.log(error);
      alert('Reset password failed: ' + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <TextInput style={styles.textInput} placeholder="Email" value={email} onChangeText={setEmail} />
      <TouchableOpacity style={styles.button} onPress={resetPassword}>
        <Text style={styles.text}>Send Reset Email</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 40,
    color: '#1A237E',
  },
  textInput: {
    height: 50,
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EAF6',
    borderWidth: 2,
    borderRadius: 15,
    marginVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    color: '#3C4858',
    shadowColor: '#9E9E9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  button: {
    width: '90%',
    marginVertical: 15,
    backgroundColor: '#5C6BC0',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5C6BC0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});