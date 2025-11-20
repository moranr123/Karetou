import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import NotificationService from './NotificationService';
import TransactionService from './TransactionService';

interface ScanHistory {
  businessId: string;
  scannedAt: string; // ISO timestamp
  pointsEarned: number;
}

interface BusinessLoyaltyPoints {
  businessId: string;
  businessName: string;
  points: number;
  scans: number; // Number of times scanned
  lastScannedAt: string; // ISO timestamp
}

interface UserPoints {
  totalPoints: number;
  scanHistory: ScanHistory[];
  lastResetDate: string; // ISO date string (YYYY-MM-DD) or timestamp for testing
  businessLoyaltyPoints?: BusinessLoyaltyPoints[]; // Points per business
}

class PointsService {
  private static instance: PointsService;

  static getInstance(): PointsService {
    if (!PointsService.instance) {
      PointsService.instance = new PointsService();
    }
    return PointsService.instance;
  }

  // Get current timestamp (for 1-minute testing)
  private getCurrentTimestamp(): number {
    return Date.now();
  }

  // Check if a scan is within the last minute (for testing)
  private isWithinLastMinute(scanTimestamp: string): boolean {
    const scanTime = new Date(scanTimestamp).getTime();
    const oneMinuteAgo = Date.now() - (60 * 1000); // 1 minute in milliseconds
    return scanTime > oneMinuteAgo;
  }

  // Reset scan history - remove scans older than 1 minute (for testing)
  private async resetDailyScans(userId: string, userPoints: UserPoints): Promise<UserPoints> {
    const now = this.getCurrentTimestamp();
    const oneMinuteAgo = now - (60 * 1000); // 1 minute ago
    
    // Filter out scans older than 1 minute
    const recentScans = userPoints.scanHistory.filter(scan => {
      const scanTime = new Date(scan.scannedAt).getTime();
      return scanTime > oneMinuteAgo;
    });

    // Only update if there were scans removed
    if (recentScans.length !== userPoints.scanHistory.length) {
      // Update user points with only recent scans (within last minute)
      await updateDoc(doc(db, 'users', userId), {
        'points.scanHistory': recentScans,
        'points.lastResetDate': now.toString(),
      });

      return {
        ...userPoints,
        scanHistory: recentScans,
        lastResetDate: now.toString(),
      };
    }

    return userPoints;
  }

  // Get user points data
  async getUserPoints(userId: string): Promise<UserPoints> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const points = userData.points || {
          totalPoints: 0,
          scanHistory: [],
          lastResetDate: this.getCurrentTimestamp().toString(),
        };

        // Reset scans older than 1 minute if needed
        const updatedPoints = await this.resetDailyScans(userId, points as UserPoints);
        return updatedPoints;
      } else {
        // Initialize points for new user
        const initialPoints: UserPoints = {
          totalPoints: 0,
          scanHistory: [],
          lastResetDate: this.getCurrentTimestamp().toString(),
        };
        await setDoc(doc(db, 'users', userId), {
          points: initialPoints,
        }, { merge: true });
        return initialPoints;
      }
    } catch (error) {
      console.error('Error getting user points:', error);
      return {
        totalPoints: 0,
        scanHistory: [],
        lastResetDate: this.getCurrentTimestamp().toString(),
      };
    }
  }

  // Check if user has already scanned this business within the last minute (for testing)
  async hasScannedToday(userId: string, businessId: string): Promise<boolean> {
    try {
      const userPoints = await this.getUserPoints(userId);

      return userPoints.scanHistory.some(scan => {
        return scan.businessId === businessId && this.isWithinLastMinute(scan.scannedAt);
      });
    } catch (error) {
      console.error('Error checking scan history:', error);
      return false;
    }
  }

  // Check if user has ever scanned this business (for review validation)
  async hasScannedBusiness(userId: string, businessId: string): Promise<boolean> {
    try {
      const userPoints = await this.getUserPoints(userId);

      return userPoints.scanHistory.some(scan => {
        return scan.businessId === businessId;
      });
    } catch (error) {
      console.error('Error checking if user scanned business:', error);
      return false;
    }
  }

  // Get points value for a business (default: 10 points)
  async getBusinessPoints(businessId: string): Promise<number> {
    try {
      const businessDoc = await getDoc(doc(db, 'businesses', businessId));
      if (businessDoc.exists()) {
        const businessData = businessDoc.data();
        // Points can be set per business, default is 10
        return businessData.rewardPoints || 10;
      }
      return 10; // Default points
    } catch (error) {
      console.error('Error getting business points:', error);
      return 10; // Default points
    }
  }

  // Award points for scanning a business
  async awardPointsForScan(userId: string, businessId: string): Promise<{ success: boolean; pointsEarned: number; message: string }> {
    try {
      // Check if already scanned today
      const alreadyScanned = await this.hasScannedToday(userId, businessId);
      if (alreadyScanned) {
        return {
          success: false,
          pointsEarned: 0,
          message: 'You have already scanned this business recently. Wait 1 minute to scan again!',
        };
      }

      // Get business points value
      const pointsToAward = await this.getBusinessPoints(businessId);

      // Get current user points
      const userPoints = await this.getUserPoints(userId);

      // Add new scan to history
      const newScan: ScanHistory = {
        businessId,
        scannedAt: new Date().toISOString(),
        pointsEarned: pointsToAward,
      };

      // Get business name for loyalty tracking
      const businessDoc = await getDoc(doc(db, 'businesses', businessId));
      const businessName = businessDoc.exists() ? businessDoc.data().businessName || 'Unknown Business' : 'Unknown Business';

      const updatedHistory = [...userPoints.scanHistory, newScan];
      const updatedTotalPoints = userPoints.totalPoints + pointsToAward;

      // Update or add business loyalty points
      const currentBusinessLoyalty = userPoints.businessLoyaltyPoints || [];
      const existingBusinessIndex = currentBusinessLoyalty.findIndex(bp => bp.businessId === businessId);
      
      let updatedBusinessLoyalty: BusinessLoyaltyPoints[];
      if (existingBusinessIndex >= 0) {
        // Update existing business loyalty
        updatedBusinessLoyalty = [...currentBusinessLoyalty];
        updatedBusinessLoyalty[existingBusinessIndex] = {
          ...updatedBusinessLoyalty[existingBusinessIndex],
          points: updatedBusinessLoyalty[existingBusinessIndex].points + pointsToAward,
          scans: updatedBusinessLoyalty[existingBusinessIndex].scans + 1,
          lastScannedAt: new Date().toISOString(),
        };
      } else {
        // Add new business loyalty
        updatedBusinessLoyalty = [
          ...currentBusinessLoyalty,
          {
            businessId,
            businessName,
            points: pointsToAward,
            scans: 1,
            lastScannedAt: new Date().toISOString(),
          },
        ];
      }

      // Update user points in Firestore
      await updateDoc(doc(db, 'users', userId), {
        'points.totalPoints': updatedTotalPoints,
        'points.scanHistory': updatedHistory,
        'points.lastResetDate': this.getCurrentTimestamp().toString(),
        'points.businessLoyaltyPoints': updatedBusinessLoyalty,
      });

      return {
        success: true,
        pointsEarned: pointsToAward,
        message: `🎉 You earned ${pointsToAward} points!`,
      };
    } catch (error) {
      console.error('Error awarding points:', error);
      return {
        success: false,
        pointsEarned: 0,
        message: 'Failed to award points. Please try again.',
      };
    }
  }

  // Get user's total points
  async getTotalPoints(userId: string): Promise<number> {
    try {
      const userPoints = await this.getUserPoints(userId);
      return userPoints.totalPoints;
    } catch (error) {
      console.error('Error getting total points:', error);
      return 0;
    }
  }

  // Get loyalty points per business
  async getBusinessLoyaltyPoints(userId: string): Promise<BusinessLoyaltyPoints[]> {
    try {
      const userPoints = await this.getUserPoints(userId);
      return userPoints.businessLoyaltyPoints || [];
    } catch (error) {
      console.error('Error getting business loyalty points:', error);
      return [];
    }
  }

  // Get loyalty points for a specific business
  async getLoyaltyPointsForBusiness(userId: string, businessId: string): Promise<number> {
    try {
      const businessLoyalty = await this.getBusinessLoyaltyPoints(userId);
      const business = businessLoyalty.find(bp => bp.businessId === businessId);
      return business ? business.points : 0;
    } catch (error) {
      console.error('Error getting loyalty points for business:', error);
      return 0;
    }
  }

  // Transfer points from user to business
  async transferPointsToBusiness(
    userId: string, 
    businessId: string, 
    pointsToTransfer: number,
    userName: string
  ): Promise<{ success: boolean; message: string; remainingPoints?: number }> {
    try {
      if (pointsToTransfer <= 0) {
        return {
          success: false,
          message: 'Points to transfer must be greater than 0.',
        };
      }

      // Get user points
      const userPoints = await this.getUserPoints(userId);
      
      // Check if user has enough points
      if (userPoints.totalPoints < pointsToTransfer) {
        return {
          success: false,
          message: `Insufficient points. You have ${userPoints.totalPoints} points.`,
        };
      }

      // Get business details
      const businessDoc = await getDoc(doc(db, 'businesses', businessId));
      if (!businessDoc.exists()) {
        return {
          success: false,
          message: 'Business not found.',
        };
      }

      const businessData = businessDoc.data();
      const businessOwnerId = businessData.userId;
      const businessName = businessData.businessName || 'Unknown Business';

      if (!businessOwnerId) {
        return {
          success: false,
          message: 'Business owner not found.',
        };
      }

      // Update user points - deduct transferred points
      const updatedTotalPoints = userPoints.totalPoints - pointsToTransfer;
      
      // Update business loyalty points - deduct from the specific business
      const currentBusinessLoyalty = userPoints.businessLoyaltyPoints || [];
      const businessIndex = currentBusinessLoyalty.findIndex(bp => bp.businessId === businessId);
      
      let updatedBusinessLoyalty = [...currentBusinessLoyalty];
      if (businessIndex >= 0) {
        updatedBusinessLoyalty[businessIndex] = {
          ...updatedBusinessLoyalty[businessIndex],
          points: Math.max(0, updatedBusinessLoyalty[businessIndex].points - pointsToTransfer),
        };
      }

      // Update user document
      await updateDoc(doc(db, 'users', userId), {
        'points.totalPoints': updatedTotalPoints,
        'points.businessLoyaltyPoints': updatedBusinessLoyalty,
      });

      // Update business document - add received points
      const businessReceivedPoints = businessData.receivedPoints || 0;
      await updateDoc(doc(db, 'businesses', businessId), {
        receivedPoints: businessReceivedPoints + pointsToTransfer,
        lastPointsReceivedAt: new Date().toISOString(),
      });

      // Create notification for business owner
      const notificationService = NotificationService.getInstance();
      await notificationService.createNotification({
        title: '🎁 Points Received!',
        body: `${userName} sent you ${pointsToTransfer} loyalty points for ${businessName}!`,
        type: 'points_received',
        userId: businessOwnerId,
        read: false,
        data: {
          businessId,
          businessName,
          senderName: userName,
          pointsReceived: pointsToTransfer,
        },
      });

      // Record transaction for both user and business owner
      const transactionService = TransactionService.getInstance();
      try {
        // Record transaction for user (sent)
        await transactionService.createTransaction(
          'sent',
          userId,
          userName,
          businessId,
          businessName,
          pointsToTransfer,
          'completed'
        );

        // Record transaction for business owner (received)
        await transactionService.createTransaction(
          'received',
          userId,
          userName,
          businessId,
          businessName,
          pointsToTransfer,
          'completed'
        );
      } catch (error) {
        console.error('Error recording transaction:', error);
        // Don't fail the transfer if transaction recording fails
      }

      return {
        success: true,
        message: `Successfully sent ${pointsToTransfer} points to ${businessName}!`,
        remainingPoints: updatedTotalPoints,
      };
    } catch (error) {
      console.error('Error transferring points:', error);
      return {
        success: false,
        message: 'Failed to transfer points. Please try again.',
      };
    }
  }
}

export type { BusinessLoyaltyPoints, UserPoints, ScanHistory };

export default PointsService;

