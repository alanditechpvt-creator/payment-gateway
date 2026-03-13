import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Device from 'expo-device';

interface SecurityGuardProps {
  children: React.ReactNode;
}

export function SecurityGuard({ children }: SecurityGuardProps) {
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkSecurity() {
      try {
        let detectedReason: string | null = null;

        // Block if running on an emulator/simulator
        if (!Device.isDevice) {
          detectedReason = 'emulator';
        }

        // Block if device appears rooted/jailbroken (best-effort)
        try {
          // @ts-expect-error - method exists at runtime on supported platforms
          if (Device.isRootedExperimentalAsync) {
            // @ts-ignore
            const rooted = await Device.isRootedExperimentalAsync();
            if (rooted) {
              detectedReason = 'rooted';
            }
          }
        } catch {
          // ignore root detection errors
        }

        // Only block actual debugger in production; __DEV__ is true for Expo dev server
        // even on real devices, so we do not block on __DEV__ to allow testing.
        // Production builds have __DEV__ === false.

        if (isMounted) {
          if (detectedReason) {
            setBlocked(true);
            setReason(detectedReason);
          }
          setChecking(false);
        }
      } catch (e) {
        if (isMounted) {
          // In case of any unexpected error, fail closed: allow app, but log in console
          console.warn('SecurityGuard check failed', e);
          setChecking(false);
        }
      }
    }

    checkSecurity();

    return () => {
      isMounted = false;
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.message}>Checking device security…</Text>
      </View>
    );
  }

  if (blocked) {
    let explanation = 'Developer options or debugging appear to be enabled on this device.';
    if (reason === 'emulator') {
      explanation = 'This application cannot run on an emulator or simulator.';
    } else if (reason === 'rooted') {
      explanation = 'This device appears to be rooted / jailbroken. For security reasons, the app cannot run.';
    } else if (reason === 'debug') {
      explanation = 'Debug / developer mode is active. Please disable debugging and use a production build.';
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Security restriction</Text>
        <Text style={styles.message}>
          For security reasons, this application cannot run while developer mode or debugging features are enabled.
        </Text>
        <Text style={[styles.message, styles.subMessage]}>{explanation}</Text>
        <Text style={styles.footer}>
          If you believe this is a mistake, please contact support with a screenshot of this screen.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
    marginTop: 8,
  },
  subMessage: {
    color: '#a5b4fc',
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

