import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface LogActionParams {
  action: string;
  actionType: 'approve' | 'reject' | 'edit' | 'delete' | 'view' | 'create' | 'deactivate' | 'activate' | 'login' | 'logout';
  targetType: 'business' | 'user' | 'admin' | 'report';
  targetName: string;
  targetId: string;
  adminEmail: string;
  adminId: string;
  details?: string;
}

export const logAdminAction = async (params: LogActionParams): Promise<void> => {
  try {
    await addDoc(collection(db, 'adminHistoryLogs'), {
      ...params,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw error - logging should not break the main functionality
  }
};

