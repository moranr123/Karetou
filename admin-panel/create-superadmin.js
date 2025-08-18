const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyByXb-FgYHiNhVIsK00kM1jdXYr_OerV7Q",
  authDomain: "karetou-cfd5b.firebaseapp.com",
  projectId: "karetou-cfd5b",
  storageBucket: "karetou-cfd5b.firebasestorage.app",
  messagingSenderId: "40950648608",
  appId: "1:40950648608:web:91b4f1733a28173d2c9145",
  measurementId: "G-D4V96GLYED"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function createSuperAdmin() {
  try {
    console.log('Creating superadmin account...');
    
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      'superadmin@gmail.com',
      'Moranmoran12'
    );
    
    console.log('✅ Superadmin account created successfully!');
    console.log('📧 Email: superadmin@gmail.com');
    console.log('🔑 Password: Moranmoran12');
    console.log('🆔 UID:', userCredential.user.uid);
    console.log('\n📝 Next steps:');
    console.log('1. Copy the UID above');
    console.log('2. Open admin-panel/src/contexts/AuthContext.tsx');
    console.log('3. Replace the superAdminUids array with:');
    console.log(`   const superAdminUids = ['${userCredential.user.uid}'];`);
    console.log('4. Save the file and restart your admin panel');
    console.log('5. Login with superadmin@gmail.com / Moranmoran12');
    
  } catch (error) {
    console.error('❌ Error creating superadmin account:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n💡 The email already exists. You can:');
      console.log('1. Go to Firebase Console > Authentication > Users');
      console.log('2. Find superadmin@gmail.com');
      console.log('3. Copy the UID from there');
      console.log('4. Use that UID in your AuthContext.tsx file');
    }
  }
}

createSuperAdmin(); 