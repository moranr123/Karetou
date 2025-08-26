# Karetou - React Native Business Discovery App

A comprehensive React Native app for discovering and managing local businesses, built with Expo and Firebase.

## 🚀 Quick Start

For detailed setup instructions, see [SETUP.md](./SETUP.md)

### Quick Setup
```bash
# Clone the repository
git clone <your-repository-url>
cd Karetou

# Install dependencies
npm install

# Copy environment file and add your API keys
cp env.example .env

# Start the app
npx expo start
```

## ✨ Features

- 🔐 Firebase Authentication (User & Business)
- 🏢 Business Management & Verification
- 📍 Basic Location Services with expo-location
- 🔔 Push Notifications
- 📱 Cross-platform (iOS & Android)
- 🎨 Modern UI/UX Design
- 📊 Business Analytics & Reviews

## 📱 App Screens

### User Features
- **Home**: Discover nearby businesses
- **Feed**: Browse business posts and updates
- **Map**: Basic location functionality
- **Saved**: Bookmark favorite businesses
- **Settings**: User preferences and account

### Business Features
- **Business Dashboard**: Manage your business
- **Create Posts**: Share updates and promotions
- **Reviews**: Monitor customer feedback
- **Analytics**: Track business performance

## 🔧 Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Expo Go app on your mobile device

### Environment Configuration
1. Copy `env.example` to `.env`
2. Add your Firebase API keys
3. See [SETUP.md](./SETUP.md) for detailed instructions

## 📁 Project Structure

```
Karetou/
├── App.js                 # Main app component with navigation
├── firebase.ts           # Firebase configuration
├── app.json              # Expo configuration
├── components/           # Reusable UI components
├── contexts/             # React contexts (Auth, etc.)
├── screens/              # App screens
│   ├── userScreens/      # Regular user screens
│   └── businessOwnerScreens/ # Business owner screens
├── services/             # API and service functions
├── assets/               # App assets and images
└── utils/                # Utility functions
```

## 🛠️ Dependencies

- `expo`: Expo framework for React Native
- `firebase`: Firebase SDK for backend services
- `@react-navigation/native`: Navigation library
- `expo-location`: Basic location services
- `expo-notifications`: Push notifications
- `@expo/vector-icons`: Icon library

## 🔐 Authentication Flow

1. **App Launch**: Check for existing user session
2. **User Type**: Choose between regular user or business owner
3. **Authentication**: Login/Signup with Firebase
4. **Navigation**: Route to appropriate app stack

## 📚 Documentation

- [SETUP.md](./SETUP.md) - Detailed setup guide
- [NOTIFICATION_SYSTEM.md](./NOTIFICATION_SYSTEM.md) - Notification system documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter issues:
1. Check the [SETUP.md](./SETUP.md) troubleshooting section
2. Review Firebase Console logs
3. Open an issue in the repository

---

**Note**: Make sure to set up your own Firebase project before running the app. See [SETUP.md](./SETUP.md) for detailed instructions. 