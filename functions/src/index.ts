import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const deleteExpiredMessages = functions.scheduler.onSchedule('every 1 hours', async (context) => {
  const db = admin.firestore();
  const now = new Date();
  
  try {
    // Delete messages that are older than 24 hours
    const expiredMessages = await db
      .collection('messages')
      .where('expiresAt', '<', now)
      .get();

    const batch = db.batch();
    expiredMessages.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Deleted ${expiredMessages.size} expired messages`);
  } catch (error) {
    console.error('Error deleting expired messages:', error);
  }
}); 