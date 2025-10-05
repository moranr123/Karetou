/**
 * Initialize View Counts for Businesses
 * 
 * This script adds sample view counts to existing businesses in Firestore.
 * Run this once to populate view count data for testing the analytics dashboard.
 * 
 * Usage:
 *   node init-view-counts.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to add your service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Sample view counts - these are randomized for demonstration
const sampleViewCounts = [
  { min: 3000, max: 5000 }, // For top performers
  { min: 1500, max: 3000 }, // For mid-tier
  { min: 500, max: 1500 },  // For lower tier
  { min: 100, max: 500 },   // For new businesses
];

async function initializeViewCounts() {
  try {
    console.log('🚀 Starting view count initialization...');
    
    // Fetch all businesses
    const businessesSnapshot = await db.collection('businesses').get();
    
    if (businessesSnapshot.empty) {
      console.log('⚠️  No businesses found in the database.');
      return;
    }
    
    console.log(`📊 Found ${businessesSnapshot.size} businesses`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    businessesSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Only add viewCount if it doesn't exist or is 0
      if (!data.viewCount || data.viewCount === 0) {
        // Assign random view count based on tier
        const tier = Math.floor(Math.random() * sampleViewCounts.length);
        const range = sampleViewCounts[tier];
        const viewCount = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        
        batch.update(doc.ref, { viewCount });
        updateCount++;
        console.log(`  ✅ ${data.businessName || 'Unknown'}: ${viewCount} views`);
      } else {
        console.log(`  ⏭️  ${data.businessName || 'Unknown'}: Already has ${data.viewCount} views`);
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`\n✨ Successfully initialized view counts for ${updateCount} businesses!`);
    } else {
      console.log('\n✨ All businesses already have view counts.');
    }
    
  } catch (error) {
    console.error('❌ Error initializing view counts:', error);
  } finally {
    process.exit();
  }
}

// Run the initialization
initializeViewCounts();
