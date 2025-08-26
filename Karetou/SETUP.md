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

### 3. Firebase Configuration

#### Option A: Direct Configuration (Recommended)
1. Open `firebase.ts` file
2. Replace the Firebase configuration with your own:
   ```typescript
   const firebaseConfig = {
       apiKey: "your_firebase_api_key",
       authDomain: "your_project.firebaseapp.com",
       projectId: "your_project_id",
       storageBucket: "your_project.appspot.com",
       messagingSenderId: "your_sender_id",
       appId: "your_app_id",
       measurementId: "your_measurement_id"
   };
   ```

#### Option B: Using Environment Variables (Advanced)
If you want to use environment variables for production builds:
1. Set up environment variables in your build system (EAS Build, etc.)
2. Use `Constants.expoConfig.extra` to access them
3. This requires additional configuration for production builds

### 4. Get Your Firebase API Keys

#### Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Add a web app to your project
4. Copy the configuration object
5. Enable Authentication, Firestore, and Storage services

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
- Check that all Firebase API keys are correctly set in `firebase.ts`
- Verify Firebase services are enabled
- Check console for error messages

### Firebase Connection Issues
- Verify Firebase project ID matches your config
- Check if Firebase services are enabled
- Ensure your app's bundle ID is registered

### Build Errors
- Make sure all dependencies are installed (`npm install`)
- Clear Metro cache: `npx expo start -c`
- Check for syntax errors in your Firebase configuration

## 📱 App Features

- **User Authentication**: Login/Signup with Firebase
- **Business Management**: Create and manage business profiles
- **Location Services**: Basic location functionality with expo-location
- **Notifications**: Push notifications for updates
- **Feed System**: Browse business posts and updates

## 🔐 Security Notes

- Keep your Firebase API keys secure
- Use appropriate Firebase security rules
- Regularly review your Firebase project settings
- Consider using environment variables for production builds

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Firebase Console logs
3. Check Expo documentation
4. Open an issue in the repository

## 🎉 You're All Set!

The Karetou app should now be running successfully on your device. Happy coding!
