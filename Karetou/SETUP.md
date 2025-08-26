# 🚀 Karetou App Setup Guide

This guide will help you set up the Karetou app on your local machine after cloning the repository.

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Expo Go app on your mobile device
- Git

## 🔧 Installation Steps

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd Karetou
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup

#### Option A: Using Environment Variables (Recommended)
1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` file and add your own API keys:
   ```env
   # Firebase Configuration
   FIREBASE_API_KEY=your_firebase_api_key_here
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id

   # Google Maps API Key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
   ```

#### Option B: Direct Configuration
If you prefer to directly edit the files:
1. Update `firebase.ts` with your Firebase config
2. Update `app.json` with your Google Maps API key

### 4. Get Your API Keys

#### Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Add a web app to your project
4. Copy the configuration object
5. Enable Authentication, Firestore, and Storage services

#### Google Maps Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Maps SDK for Android and iOS
4. Create credentials (API Key)
5. Restrict the API key to your app's bundle ID

### 5. Run the App
```bash
npx expo start
```

### 6. Test on Device
1. Install Expo Go on your mobile device
2. Scan the QR code displayed in your terminal
3. The app should load successfully

## 🚨 Troubleshooting

### App Won't Load After Scanning QR
- Check that all API keys are correctly set
- Verify Firebase services are enabled
- Ensure Google Maps API key is valid
- Check console for error messages

### Firebase Connection Issues
- Verify Firebase project ID matches your config
- Check if Firebase services are enabled
- Ensure your app's bundle ID is registered

### Google Maps Not Working
- Verify Maps SDK is enabled in Google Cloud Console
- Check API key restrictions
- Ensure billing is enabled for Google Cloud project

## 📱 App Features

- **User Authentication**: Login/Signup with Firebase
- **Business Management**: Create and manage business profiles
- **Location Services**: Find nearby places with Google Maps
- **Notifications**: Push notifications for updates
- **Feed System**: Browse business posts and updates

## 🔐 Security Notes

- Never commit your `.env` file to version control
- Keep your API keys secure and private
- Use appropriate API key restrictions
- Regularly rotate your API keys

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Firebase and Google Cloud Console logs
3. Check Expo documentation
4. Open an issue in the repository

## 🎉 You're All Set!

The Karetou app should now be running successfully on your device. Happy coding!
