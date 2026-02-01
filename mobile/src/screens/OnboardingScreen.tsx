import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingScreen({ route }: any) {
  const { token } = route?.params || {};
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    businessName: '',
    panNumber: '',
    aadhaarNumber: '',
  });
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
  
  const pickImage = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };
  
  const takePhoto = async (setter: (uri: string) => void) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is required to take photos');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };
  
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepSubtitle}>Please provide your details</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter first name"
          placeholderTextColor="#52525b"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter last name"
          placeholderTextColor="#52525b"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter phone number"
          placeholderTextColor="#52525b"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Name (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter business name"
          placeholderTextColor="#52525b"
          value={formData.businessName}
          onChangeText={(text) => setFormData({ ...formData, businessName: text })}
        />
      </View>
    </View>
  );
  
  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Identity Verification</Text>
      <Text style={styles.stepSubtitle}>KYC documents required</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PAN Number</Text>
        <TextInput
          style={styles.input}
          placeholder="ABCDE1234F"
          placeholderTextColor="#52525b"
          autoCapitalize="characters"
          maxLength={10}
          value={formData.panNumber}
          onChangeText={(text) => setFormData({ ...formData, panNumber: text.toUpperCase() })}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Aadhaar Number</Text>
        <TextInput
          style={styles.input}
          placeholder="1234 5678 9012"
          placeholderTextColor="#52525b"
          keyboardType="numeric"
          maxLength={12}
          value={formData.aadhaarNumber}
          onChangeText={(text) => setFormData({ ...formData, aadhaarNumber: text })}
        />
      </View>
    </View>
  );
  
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Upload Documents</Text>
      <Text style={styles.stepSubtitle}>Take clear photos of your documents</Text>
      
      {/* Profile Photo */}
      <View style={styles.uploadSection}>
        <Text style={styles.label}>Profile Photo</Text>
        <TouchableOpacity
          style={styles.uploadBox}
          onPress={() => takePhoto(setProfilePhoto)}
        >
          {profilePhoto ? (
            <Image source={{ uri: profilePhoto }} style={styles.uploadedImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="camera" size={32} color="#6366f1" />
              <Text style={styles.uploadText}>Take Photo</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Aadhaar Front */}
      <View style={styles.uploadSection}>
        <Text style={styles.label}>Aadhaar Card (Front)</Text>
        <TouchableOpacity
          style={styles.uploadBox}
          onPress={() => pickImage(setAadhaarFront)}
        >
          {aadhaarFront ? (
            <Image source={{ uri: aadhaarFront }} style={styles.uploadedImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="document" size={32} color="#6366f1" />
              <Text style={styles.uploadText}>Upload Front</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Aadhaar Back */}
      <View style={styles.uploadSection}>
        <Text style={styles.label}>Aadhaar Card (Back)</Text>
        <TouchableOpacity
          style={styles.uploadBox}
          onPress={() => pickImage(setAadhaarBack)}
        >
          {aadhaarBack ? (
            <Image source={{ uri: aadhaarBack }} style={styles.uploadedImage} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="document" size={32} color="#6366f1" />
              <Text style={styles.uploadText}>Upload Back</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progress}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={styles.progressItem}>
            <View style={[styles.progressDot, step >= s && styles.progressDotActive]}>
              {step > s ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <Text style={styles.progressDotText}>{s}</Text>
              )}
            </View>
            {s < 3 && <View style={[styles.progressLine, step > s && styles.progressLineActive]} />}
          </View>
        ))}
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ScrollView>
      
      {/* Navigation */}
      <View style={styles.navigation}>
        {step > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => (step < 3 ? setStep(step + 1) : Alert.alert('Success', 'Onboarding complete!'))}
        >
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtnGradient}
          >
            <Text style={styles.nextBtnText}>{step === 3 ? 'Submit' : 'Continue'}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: '#6366f1',
  },
  progressDotText: {
    color: '#71717a',
    fontWeight: '600',
  },
  progressLine: {
    width: 60,
    height: 2,
    backgroundColor: '#27272a',
  },
  progressLineActive: {
    backgroundColor: '#6366f1',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  stepContent: {},
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#a1a1aa',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111118',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadBox: {
    height: 160,
    backgroundColor: '#111118',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    color: '#6366f1',
    marginTop: 8,
    fontWeight: '500',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  navigation: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  nextBtn: {
    flex: 1,
    marginLeft: 12,
  },
  nextBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

