import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [cameraType] = useState<CameraType>('back');
  const navigation = useNavigation<any>();

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    // Simple convention: wallet:transfer:<userId>
    if (data.startsWith('wallet:transfer:')) {
      const userId = data.replace('wallet:transfer:', '').trim();
      if (userId) {
        Alert.alert('Transfer', 'Start transfer to this user?', [
          { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Transfer', { toUserId: userId });
            },
          },
        ]);
        return;
      }
    }

    Alert.alert('Scanned', data, [
      {
        text: 'OK',
        onPress: () => setScanned(false),
      },
    ]);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-off-outline" size={48} color="#71717a" />
        <Text style={styles.text}>Camera access denied</Text>
        <Text style={styles.subtext}>Enable camera permission in device settings to scan QR codes.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <Camera
          style={StyleSheet.absoluteFillObject}
          type={cameraType}
          onBarCodeScanned={handleBarCodeScanned as any}
          barCodeScannerSettings={{
            barCodeTypes: ['qr'],
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.scanBox} />
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Scan QR code</Text>
        <Text style={styles.footerText}>Point your camera at the QR. For quick transfers, use codes like:</Text>
        <Text style={styles.footerExample}>wallet:transfer:&lt;USER_ID&gt;</Text>
        {scanned && (
          <TouchableOpacity style={styles.btn} onPress={() => setScanned(false)}>
            <Text style={styles.btnText}>Scan again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 2, position: 'relative' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 230,
    height: 230,
    borderWidth: 3,
    borderColor: '#6366f1',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  footer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  footerTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  footerText: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },
  footerExample: { fontSize: 13, color: '#a5b4fc', fontFamily: 'monospace' },
  btn: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    padding: 16,
  },
  text: { color: '#e5e7eb', marginTop: 8, fontSize: 14 },
  subtext: { color: '#9ca3af', marginTop: 4, fontSize: 13, textAlign: 'center' },
});

