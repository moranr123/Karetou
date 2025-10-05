# Business Category & User Preferences Implementation

## Overview
This document details the implementation of business categories and user preferences for personalized content filtering in the Karetou app.

## Features Implemented

### 1. Business Category Selection
- **Location**: `RegisterBusinessScreen.tsx`
- **Categories Available**:
  - Historical Landmarks
  - Korean BBQ
  - Modern/Minimalist Cafés
  - Budget-Friendly Eats
  - Fine Dining
  - Heritage Cafés
  - Nature Spots
  - Amusement

**Implementation Details**:
- Added `selectedCategories` state to track the selected categories (array)
- Created a vertical list of checkbox options in a column layout
- Multi-select capability - businesses can belong to multiple categories
- Added validation to ensure at least one category is selected before proceeding
- Categories array is passed through the entire business registration flow (RegisterBusinessScreen → BusinessIDVerification → BusinessLocation)
- Categories are saved to Firestore as `selectedCategories` field (array) in the business document
- Backward compatible: handles old `selectedCategory` (string) format if present

### 2. User Preferences Modal
- **Location**: `components/UserPreferencesModal.tsx`
- **Features**:
  - Beautiful, modern UI with gradient header
  - Multi-select capability for choosing preferred categories
  - Checkbox-based selection in a vertical column layout
  - Visual feedback with filled checkboxes for selected categories
  - Selection counter showing how many preferences are selected
  - "Skip for now" option for users who don't want to set preferences
  - "Save Preferences" button (disabled if no selections)

**UI Design**:
- Gradient header with heart icon (Purple/Blue theme)
- Vertical list of checkboxes in a column layout
- Multi-select: users can select multiple categories
- Selected categories show filled checkboxes
- Clean, list-based interface with individual row selection
- Centered modal with fade animation
- Rounded corners with shadow for modern look

### 3. Signup and Email Verification Flow Integration
- **Locations**: 
  - `screens/userScreens/SignupScreen.tsx` - Account creation
  - `screens/userScreens/EmailVerificationScreen.tsx` - Email verification & preferences modal

- **Flow**:
  1. User completes signup form
  2. Account is created in Firebase with `hasSetPreferences: false`
  3. Email verification link is sent
  4. User clicks verification link in email
  5. User clicks "I've Verified My Email" button in app
  6. **NEW**: User Preferences Modal appears immediately after email verification (for regular users only)
  7. User selects preferred categories (or skips)
  8. Preferences are saved to Firestore user document
  9. User is logged in and can start using the app

**Implementation Details**:
- Added `hasSetPreferences: false` field to user document on signup
- EmailVerificationScreen checks `hasSetPreferences` flag after successful email verification
- If `hasSetPreferences === false` and `userType === 'user'`, the preferences modal is shown
- After preferences are set (or skipped), `hasSetPreferences` is updated to `true`
- User type is set AFTER preferences are saved, completing the verification flow
- Modal only appears once per user account
- Business accounts skip this step entirely
- Preferences are saved as an array in the user document: `preferences: []`

### 4. Home Screen Filtering
- **Location**: `screens/userScreens/HomeScreen.tsx`
- **Features**:
  - Loads user preferences on component mount
  - Applies preference-based filtering to all business listings
  - Businesses matching user preferences appear first
  - Real-time updates when preferences change
  - Works in combination with existing business type filters

**Implementation Details**:
- Added `userPreferences` state
- Created `loadUserPreferences()` function with Firestore onSnapshot listener
- Created `applyPreferenceFilter()` function that sorts businesses:
  - Businesses matching user preferences appear first
  - Other businesses appear after
- Updated `loadPlacesToVisit()` to include `category` field
- Updated `loadSuggestedPlaces()` to include `category` field
- Modified both functions to apply preference filtering
- Added preferences to the refresh callback
- Updated useEffect to re-apply filtering when preferences change

## Data Structure

### Business Document (Firestore)
```javascript
{
  businessName: string,
  selectedType: string, // "Coffee Shop", "Tourist Spot", "Restaurant"
  selectedCategories: string[], // New field - array of selected categories
  // ... other business fields
}
```

### User Document (Firestore)
```javascript
{
  fullName: string,
  email: string,
  userType: 'user',
  preferences: string[], // New field - array of selected categories
  hasSetPreferences: boolean, // New field - tracks if user has completed preferences setup
  // ... other user fields
}
```

## User Experience Flow

### For Business Owners:
1. Register business with permit details
2. Select business type (Coffee Shop, Tourist Spot, Restaurant)
3. **NEW**: Select business categories - multiple selections allowed (Historical Landmarks, Korean BBQ, etc.)
4. Continue with business hours, images, etc.
5. Submit for admin approval

### For Regular Users:
1. Sign up with email and password
2. Verify email via the verification link sent to inbox
3. Click "I've Verified My Email" button in the app
4. **NEW**: Preferences modal appears immediately after verification
5. Select preferred categories (or skip)
6. Browse businesses - preferred categories appear first

### Home Screen Experience:
- "Suggested Places" section shows businesses based on preferences
- "Places To Visit" section is sorted by preferences
- Users can still filter by business type (Coffee Shops, Tourist Spots, Restaurants)
- Preference filtering is transparent - no UI change, just smarter sorting

## Benefits

1. **Personalization**: Users see content relevant to their interests first
2. **Discovery**: Users can still see all businesses, just in a smarter order
3. **Business Visibility**: Businesses in multiple popular categories get more visibility to interested users
4. **Flexibility**: 
   - Users can skip preferences or change them later (future feature)
   - Businesses can belong to multiple categories, increasing discoverability
5. **Non-Intrusive**: Filtering happens in the background, maintaining familiar UI
6. **Better Matching**: Multi-category support means better alignment between user interests and business offerings

## Future Enhancements

1. **Edit Preferences**: Add a settings screen where users can modify their preferences
2. **Smart Recommendations**: Use view history and interactions to suggest new categories
3. **Category Analytics**: Show business owners which categories are most popular
4. **Trending Categories**: Highlight categories gaining popularity
5. **Category-Based Search**: Add dedicated category filters in search functionality

## Testing

### To Test Business Category:
1. Open the app as a business owner
2. Go to "Register Business"
3. Fill in permit details
4. Select a business type
5. Scroll through and select multiple categories using checkboxes
6. Verify at least one category is required (try to proceed without selecting)
7. Complete registration and verify the categories array is saved

### To Test User Preferences:
1. Create a new regular user account
2. Check your email and click the verification link
3. Return to the app and click "I've Verified My Email"
4. The preferences modal should appear immediately after verification
5. Select multiple categories
6. Click "Save Preferences"
7. You'll be automatically logged in and see the Home screen
8. Businesses with matching categories should appear first
9. Log out and log in again - modal should NOT appear (only shows once after verification)

### To Test Filtering:
1. Create multiple test businesses with different category combinations
2. Create a user with specific preferences (e.g., "Korean BBQ", "Fine Dining")
3. Log in and check the Home screen
4. Businesses with ANY matching category should appear at the top
5. Apply business type filters - preference sorting should still work
6. A business with multiple categories gets prioritized if any match user preferences

## Technical Notes

- All category names use consistent capitalization and formatting
- Both business categories and user preferences are stored as arrays
- Preference filtering uses array sorting with `.some()` method to check for matches
- A business matches if ANY of its categories are in the user's preferences
- Real-time updates ensure immediate synchronization
- Empty preferences array means no filtering is applied
- Backward compatible: handles old `selectedCategory` (string) format if present
- Users without preferences see businesses in default order
- Multi-select allows businesses to appear in more search results

## Files Modified

1. `Karetou/screens/userScreens/businessOwnerScreens/RegisterBusinessScreen.tsx` - Multi-select categories
2. `Karetou/screens/userScreens/businessOwnerScreens/BusinessIDVerification.tsx` - Updated type definitions
3. `Karetou/screens/userScreens/businessOwnerScreens/BusinessLocation.tsx` - Updated type definitions
4. `Karetou/components/UserPreferencesModal.tsx` (NEW) - Centered modal with checkboxes
5. `Karetou/screens/userScreens/SignupScreen.tsx` - Add `hasSetPreferences` flag on registration
6. `Karetou/screens/userScreens/EmailVerificationScreen.tsx` - Show preferences modal after email verification
7. `Karetou/screens/userScreens/HomeScreen.tsx` - Smart filtering based on preferences

All changes have been tested and no linter errors were found.
