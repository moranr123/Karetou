import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type ActivityType = 
  | 'admin_created'
  | 'admin_deleted'
  | 'admin_activated'
  | 'admin_deactivated'
  | 'user_deactivated'
  | 'user_activated'
  | 'user_deleted'
  | 'business_approved'
  | 'business_rejected'
  | 'login'
  | 'logout';

export interface ActivityLog {
  id?: string;
  type: ActivityType;
  title: string;
  description: string;
  performedBy: {
    uid: string;
    email: string;
    role: 'superadmin' | 'admin';
  };
  targetId?: string;
  targetType?: 'user' | 'admin' | 'business';
  metadata?: Record<string, any>;
  timestamp: string | Timestamp;
}

export const logActivity = async (activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'adminActivityLogs'), {
      ...activity,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

