# Environment Variables Setup

## Overview
This project uses environment variables to store sensitive configuration data like API keys. This ensures that sensitive information is not committed to version control.

## Setup Instructions

### 1. Create `.env` File

Copy the example file:
```bash
cp .env.example .env
```

### 2. Fill in Your Values

Open `.env` and replace the placeholder values with your actual Firebase configuration:

```env
REACT_APP_FIREBASE_API_KEY=your-actual-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
REACT_APP_SUPERADMIN_UIDS=uid1,uid2,uid3
```

### 3. Get Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → Project settings
4. Scroll down to "Your apps" section
5. Click on the web app (or create one)
6. Copy the configuration values

### 4. Super Admin UIDs

- Get the UID(s) of users who should have superadmin access
- Add them as a comma-separated list: `uid1,uid2,uid3`
- You can find UIDs in Firebase Authentication → Users

## Important Notes

⚠️ **Security:**
- Never commit `.env` file to git
- The `.env` file is already in `.gitignore`
- Only commit `.env.example` as a template

⚠️ **Restart Required:**
- After creating/updating `.env`, restart your development server:
  ```bash
  npm start
  ```

⚠️ **Production Deployment:**
- For Firebase Hosting, set environment variables in:
  - Firebase Console → Hosting → Environment variables
  - Or use Firebase Functions environment config
  - Or set them in your CI/CD pipeline

## Current Configuration

The project is currently configured to use:
- **Project ID**: `karetou-cfd5b`
- **Hosting Project**: `karetouadmin`

Make sure your `.env` file matches your Firebase project configuration.

## Troubleshooting

### Environment variables not working?
1. Make sure the file is named exactly `.env` (not `.env.txt`)
2. Restart the development server after creating/updating `.env`
3. Check that variable names start with `REACT_APP_`
4. Verify no typos in variable names

### Build fails?
- Ensure all required environment variables are set
- Check for missing values in `.env` file
- Verify Firebase configuration is correct

