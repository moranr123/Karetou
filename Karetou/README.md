# Karetou - React Native Authentication App

A beautiful React Native app with Firebase authentication featuring login and signup screens.

## Features

- 🔐 Firebase Authentication
- 📱 Beautiful UI with modern design
- 🔄 Automatic navigation based on auth state
- 👁️ Password visibility toggle
- ✅ Form validation
- 🎨 Responsive design
- 📱 Cross-platform (iOS & Android)

## Screenshots

- **Login Screen**: Clean login interface with email and password fields
- **Signup Screen**: User registration with password confirmation
- **Home Screen**: Welcome screen showing user information and logout option

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password authentication
4. Get your Firebase config:
   - Go to Project Settings > General
   - Scroll down to "Your apps" section
   - Click on the web app icon (</>) to add a web app
   - Copy the config object

### 3. Update Firebase Config

Open `firebase.js` and replace the placeholder config with your actual Firebase configuration:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

### 4. Run the App

```bash
# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## Project Structure

```
Karetou/
├── App.js                 # Main app component with navigation
├── firebase.js           # Firebase configuration
├── contexts/
│   └── AuthContext.js    # Authentication context
├── screens/
│   ├── LoginScreen.js    # Login screen
│   ├── SignupScreen.js   # Signup screen
│   └── HomeScreen.js     # Home screen (authenticated)
└── assets/               # App assets
```

## Dependencies

- `react-native`: Core React Native framework
- `expo`: Expo framework for React Native
- `firebase`: Firebase SDK for authentication
- `@react-navigation/native`: Navigation library
- `@react-navigation/stack`: Stack navigator
- `@react-native-async-storage/async-storage`: Local storage
- `@expo/vector-icons`: Icon library

## Authentication Flow

1. **App Launch**: App checks for existing user session
2. **Unauthenticated**: Shows Login/Signup screens
3. **Login**: User enters email/password, Firebase validates
4. **Signup**: User creates account with email/password
5. **Authenticated**: App navigates to Home screen
6. **Logout**: User can logout, returns to Login screen

## Features Explained

### Login Screen
- Email and password input fields
- Password visibility toggle
- Form validation
- Loading states
- Navigation to signup

### Signup Screen
- Email, password, and confirm password fields
- Password matching validation
- Minimum password length check
- Loading states
- Navigation to login

### Home Screen
- Displays user information
- Logout functionality with confirmation
- Clean, modern design

## Customization

### Styling
All styles are defined in each component's StyleSheet. You can customize:
- Colors (primary: #007AFF, background: #f8f9fa)
- Typography (fonts, sizes, weights)
- Layout (padding, margins, spacing)
- Shadows and elevation

### Firebase Features
You can extend the app with additional Firebase features:
- Firestore for user data
- Cloud Storage for files
- Cloud Functions for backend logic
- Analytics and Crashlytics

## Troubleshooting

### Common Issues

1. **Firebase config error**: Make sure you've updated the config in `firebase.js`
2. **Navigation error**: Ensure all navigation dependencies are installed
3. **AsyncStorage error**: Make sure `@react-native-async-storage/async-storage` is installed

### Getting Help

- Check the [Expo documentation](https://docs.expo.dev/)
- Review [Firebase documentation](https://firebase.google.com/docs)
- Check [React Navigation docs](https://reactnavigation.org/)

## License

This project is open source and available under the [MIT License](LICENSE). 