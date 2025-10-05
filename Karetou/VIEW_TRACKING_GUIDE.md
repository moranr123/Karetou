# 📊 Business View Tracking Guide

## How View Counting Works

### Current System

The **Top-Performing Businesses** section in the admin dashboard displays businesses ranked by their view count. Here's how the system works:

```
User Views Business → viewCount increments → Admin Dashboard displays rankings
```

### Admin Dashboard (Already Implemented ✅)

The admin dashboard at `admin-panel/src/pages/Dashboard.tsx`:

1. **Reads** the `viewCount` field from each business in Firestore
2. **Sorts** businesses by view count (highest to lowest)
3. **Displays** top 5 businesses with rankings and view counts
4. **Updates in real-time** when view counts change

### Mobile App (Needs Implementation ⚠️)

**Currently, view tracking is NOT implemented in the mobile app.** You need to add it.

## 🚀 How to Implement View Tracking

### Step 1: Use the Tracking Utility

A utility file has been created at `Karetou/utils/trackBusinessView.ts` with the function:

```typescript
import { trackBusinessView } from '../utils/trackBusinessView';

// Track a view
await trackBusinessView(businessId);
```

### Step 2: Add Tracking to Your Screens

#### **A. HomeScreen.tsx** - When users view business details

Find where businesses are displayed and add tracking when a user taps to view details:

```typescript
import { trackBusinessView } from '../../utils/trackBusinessView';

// In your business card press handler
const handleBusinessPress = async (business: any) => {
  // Track the view
  await trackBusinessView(business.id);
  
  // Show business details
  setSelectedPlace(business);
  setDetailsModalVisible(true);
};
```

#### **B. Navigate.tsx** - When users select a business for navigation

```typescript
import { trackBusinessView } from '../../utils/trackBusinessView';

// When business marker is pressed
const handleMarkerPress = async (place: any) => {
  // Track the view
  await trackBusinessView(place.id);
  
  // Show details
  setSelectedPlace(place);
  setDetailsModalVisible(true);
};
```

#### **C. SearchBarScreen.tsx** - When users view search results

```typescript
import { trackBusinessView } from '../../utils/trackBusinessView';

// When search result is tapped
const handleSearchResultPress = async (business: any) => {
  // Track the view
  await trackBusinessView(business.id);
  
  // Navigate to business details
  navigation.navigate('BusinessDetails', { business });
};
```

## 📍 Recommended Implementation Points

### Priority 1 - Essential Tracking
1. **HomeScreen.tsx**: When user taps on a business card
2. **Navigate.tsx**: When user selects a business marker on the map
3. **Business Detail Modal**: When business details modal opens

### Priority 2 - Additional Tracking
4. **SearchBarScreen.tsx**: When search result is selected
5. **SavedScreen.tsx**: When viewing saved businesses
6. **FeedScreen.tsx**: When business is mentioned in a post and user views it

## 📝 Example Implementation for HomeScreen

Here's a complete example of how to add tracking to HomeScreen:

```typescript
// At the top of HomeScreen.tsx, add the import
import { trackBusinessView } from '../../utils/trackBusinessView';

// Find where you handle business card presses (around line 800-1000)
// Look for where setDetailsModalVisible is called

// Before showing the modal, add view tracking:
const handleBusinessCardPress = async (business: any) => {
  try {
    // Track the view first
    await trackBusinessView(business.id);
    
    // Then show the business details
    setSelectedPlace(business);
    setDetailsModalVisible(true);
    
    // Reset image index for the modal
    setCurrentImageIndex(0);
  } catch (error) {
    console.error('Error handling business press:', error);
    // Still show modal even if tracking fails
    setSelectedPlace(business);
    setDetailsModalVisible(true);
  }
};
```

## 🔒 Important Notes

### Don't Track Multiple Times
- Only track when user **initially views** the business
- Don't track every time they swipe through images
- Don't track when modal is re-opened for same business in one session

### Prevent Duplicate Tracking
You can add a simple check to prevent tracking the same view twice:

```typescript
const viewedBusinesses = new Set<string>();

const handleBusinessPress = async (business: any) => {
  // Only track if not already viewed in this session
  if (!viewedBusinesses.has(business.id)) {
    await trackBusinessView(business.id);
    viewedBusinesses.add(business.id);
  }
  
  setSelectedPlace(business);
  setDetailsModalVisible(true);
};
```

## 🗃️ Database Structure

Each business document will have:

```typescript
{
  businessName: string;
  // ... other fields
  viewCount: number;           // Total view count
  lastViewedAt: string;        // ISO timestamp of last view
}
```

## 🧪 Testing View Tracking

### 1. Check if it's working:
```typescript
// Add console logs
const trackBusinessView = async (businessId: string) => {
  console.log('📊 Tracking view for:', businessId);
  await updateDoc(doc(db, 'businesses', businessId), {
    viewCount: increment(1),
  });
  console.log('✅ View tracked successfully');
};
```

### 2. Verify in Firebase Console:
- Go to Firestore Database
- Open a business document
- Check if `viewCount` field increases when you view the business

### 3. Check Admin Dashboard:
- Login to admin panel
- View the "Top-Performing Businesses" section
- Rankings should update in real-time

## 🎯 Expected Behavior

After implementation:
1. User taps on a business → `viewCount` increases by 1
2. Admin dashboard automatically updates rankings
3. Top 5 businesses are displayed based on views
4. Gold/Silver/Bronze badges shown for top 3

## 🔮 Future Enhancements

Consider adding:
- **View history**: Track individual view events with timestamps
- **Unique views**: Count only unique users (not multiple views by same user)
- **Time-based metrics**: Views per day/week/month
- **Geographic tracking**: Where views are coming from
- **Conversion tracking**: Views → calls/navigation requests

## ⚡ Quick Start

1. Import the utility:
   ```typescript
   import { trackBusinessView } from '../../utils/trackBusinessView';
   ```

2. Call it when business is viewed:
   ```typescript
   await trackBusinessView(businessId);
   ```

3. Test it and check Firebase Console

4. View rankings in admin dashboard

That's it! Your view tracking system is ready! 🎉
