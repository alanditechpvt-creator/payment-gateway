# 📱 Building APK for Payment Gateway Mobile App

## Prerequisites

1. **Node.js** installed (you already have this)
2. **Expo CLI** installed globally
3. **EAS CLI** for production builds (optional)
4. **Android Studio** (optional, for local builds)

---

## Method 1: Development Build with Expo Go (Fastest - Testing)

This lets you test on a real device without building an APK.

### Step 1: Install Expo CLI
```bash
npm install -g expo-cli
```

### Step 2: Find Your Computer's IP Address
```bash
# Windows
ipconfig
# Look for "IPv4 Address" (e.g., 192.168.1.100)
```

### Step 3: Update API URL
Edit `mobile/src/api/index.ts` and replace `192.168.1.100` with your actual IP.

### Step 4: Start Expo
```bash
cd mobile
npm install
npm start
```

### Step 5: Scan QR Code
- Download **Expo Go** app on your Android phone
- Scan the QR code shown in terminal
- App will load on your phone!

> ⚠️ Your phone and computer must be on the same WiFi network

---

## Method 2: Build APK using EAS (Recommended for Distribution)

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Login to Expo
```bash
eas login
# Create account at https://expo.dev if needed
```

### Step 3: Configure EAS Build
```bash
cd mobile
eas build:configure
```

### Step 4: Build APK
```bash
# Development APK (includes dev tools)
eas build -p android --profile preview

# Production APK
eas build -p android --profile production
```

### Step 5: Download APK
- Go to https://expo.dev → Your Projects → payment-gateway
- Download the APK from the build page

---

## Method 3: Local Build (Requires Android Studio)

### Step 1: Install Android Studio
Download from: https://developer.android.com/studio

### Step 2: Set Up Android SDK
- Open Android Studio → SDK Manager
- Install Android SDK (API 33+)
- Install Android Build Tools

### Step 3: Set Environment Variables
```powershell
# Add to System Environment Variables
ANDROID_HOME = C:\Users\<username>\AppData\Local\Android\Sdk
PATH += %ANDROID_HOME%\platform-tools
PATH += %ANDROID_HOME%\tools
```

### Step 4: Build APK Locally
```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

### Step 5: Find APK
APK location: `mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## Configuration for Production

### 1. Update app.json

```json
{
  "expo": {
    "name": "PaymentGateway",
    "version": "1.0.0",
    "android": {
      "package": "com.yourcompany.paymentgateway",
      "versionCode": 1
    }
  }
}
```

### 2. Create eas.json

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### 3. Set Production API URL

Create `.env` file in mobile folder:
```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/api
```

---

## Quick Start Commands

```bash
# Install dependencies
cd mobile
npm install

# Start development server
npm start

# Build APK (cloud)
eas build -p android --profile preview

# Build APK (local - requires Android Studio)
npx expo run:android --variant release
```

---

## Troubleshooting

### "Network request failed"
- Ensure phone and computer are on same WiFi
- Check if backend is running on the correct IP
- Update API_URL in `src/api/index.ts`

### "Could not connect to development server"
- Firewall may be blocking port 19000/19001
- Try: `expo start --tunnel`

### Build fails
- Clear cache: `npx expo start --clear`
- Reinstall: `rm -rf node_modules && npm install`

---

## Assets Required

Before building, ensure these files exist in `mobile/assets/`:
- `icon.png` (1024x1024)
- `splash.png` (1242x2436)
- `adaptive-icon.png` (1024x1024)
- `favicon.png` (48x48)

If missing, create placeholder icons or use the Expo default.

