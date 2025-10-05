/**
 * Business View Tracking Utility
 * 
 * This utility tracks when users view business profiles and increments
 * the viewCount field in Firestore for analytics purposes.
 */

import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Track a business profile view
 * 
 * Call this function when a user views a business profile to increment
 * the view count in the database for analytics tracking.
 * 
 * @param businessId - The ID of the business being viewed
 * @returns Promise<void>
 * 
 * @example
 * ```typescript
 * // When user taps on a business card
 * const handleBusinessPress = async (business) => {
 *   await trackBusinessView(business.id);
 *   setSelectedPlace(business);
 *   setDetailsModalVisible(true);
 * };
 * ```
 */
export const trackBusinessView = async (businessId: string): Promise<void> => {
  try {
    if (!businessId) {
      console.warn('⚠️ Cannot track view: businessId is required');
      return;
    }

    const businessRef = doc(db, 'businesses', businessId);
    
    // Increment the viewCount field by 1
    await updateDoc(businessRef, {
      viewCount: increment(1),
      lastViewedAt: new Date().toISOString(), // Optional: track when last viewed
    });

    console.log('✅ View tracked for business:', businessId);
  } catch (error) {
    // Silently fail - don't disrupt user experience if tracking fails
    console.error('❌ Error tracking business view:', error);
  }
};

/**
 * Track a business view with user information (optional advanced tracking)
 * 
 * This version also tracks which user viewed the business for more detailed analytics.
 * 
 * @param businessId - The ID of the business being viewed
 * @param userId - The ID of the user viewing the business
 * @returns Promise<void>
 */
export const trackBusinessViewWithUser = async (
  businessId: string,
  userId: string
): Promise<void> => {
  try {
    if (!businessId) {
      console.warn('⚠️ Cannot track view: businessId is required');
      return;
    }

    const businessRef = doc(db, 'businesses', businessId);
    
    // Increment view count and track user
    await updateDoc(businessRef, {
      viewCount: increment(1),
      lastViewedAt: new Date().toISOString(),
      lastViewedBy: userId, // Track who viewed it
    });

    console.log('✅ View tracked for business:', businessId, 'by user:', userId);
  } catch (error) {
    console.error('❌ Error tracking business view:', error);
  }
};

export default trackBusinessView;
