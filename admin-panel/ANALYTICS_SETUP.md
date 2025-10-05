# Admin Dashboard Analytics Setup

## Overview

The admin dashboard now includes real-time analytics for business performance tracking:

### 1. Overview Section
Displays comprehensive business account statistics:
- **Total Registered Business Accounts**: All businesses in the system
- **Active Accounts**: Businesses that are currently operational (isActive = true)
- **Pending Approvals**: Businesses awaiting admin approval
- **Inactive/Closed Accounts**: Businesses that have been deactivated

### 2. Top-Performing Businesses
Shows the top 5 businesses ranked by view count with:
- Rank badges (gold, silver, bronze for top 3)
- Business name and type
- Total view count

## Real-Time Data

All data is updated in real-time using Firestore listeners. When any business is:
- Created
- Updated
- Activated/Deactivated
- Deleted

The dashboard will automatically refresh to show the latest statistics.

## View Count Tracking

### Current Implementation
The dashboard reads the `viewCount` field from each business document in Firestore.

### Adding View Tracking to Your Mobile App

To track business profile views in your React Native app, add this code when users view a business:

```typescript
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

// Call this function when a user views a business profile
export const trackBusinessView = async (businessId: string) => {
  try {
    const businessRef = doc(db, 'businesses', businessId);
    await updateDoc(businessRef, {
      viewCount: increment(1)
    });
  } catch (error) {
    console.error('Error tracking business view:', error);
  }
};
```

### Suggested Implementation Points:
1. **HomeScreen.tsx**: When user taps on a business to view details
2. **Navigate.tsx**: When user selects a business for navigation
3. **SearchBarScreen.tsx**: When user views search results

Example integration in HomeScreen:

```typescript
const handleBusinessPress = async (business) => {
  // Track the view
  await trackBusinessView(business.id);
  
  // Show business details
  setSelectedPlace(business);
  setDetailsModalVisible(true);
};
```

## Initializing Sample View Counts (For Testing)

If you want to test the analytics dashboard with sample data:

1. **Get your Firebase service account key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `serviceAccountKey.json` in the `admin-panel` folder

2. **Install firebase-admin (if not already installed):**
   ```bash
   cd admin-panel
   npm install firebase-admin
   ```

3. **Run the initialization script:**
   ```bash
   node init-view-counts.js
   ```

This will add random view counts to all businesses that don't have them yet.

## Database Structure

Each business document should have:

```typescript
{
  businessName: string;
  businessOwner: string;
  selectedType: string;
  businessAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  viewCount: number;  // ← New field for analytics
  // ... other fields
}
```

## Features

- ✅ Real-time data updates
- ✅ Color-coded statistics cards
- ✅ Top 5 businesses leaderboard
- ✅ Rank badges (gold, silver, bronze)
- ✅ Responsive design
- ✅ Automatic refresh on data changes

## Future Enhancements

Potential additions for more comprehensive analytics:

1. **Time-based metrics**
   - Views per day/week/month
   - Growth trends over time

2. **User engagement metrics**
   - Average time on profile
   - Interaction rate (calls, navigation requests)

3. **Geographic analytics**
   - Most viewed businesses by location
   - Regional performance comparison

4. **Business owner insights**
   - Individual business owner dashboard
   - Performance notifications

5. **Export functionality**
   - CSV/Excel export of analytics data
   - Scheduled reports

## Support

For issues or questions, check the main README.md or contact the development team.
