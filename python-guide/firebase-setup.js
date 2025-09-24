// Firebase Realtime Database Security Rules
// Copy these rules to your Firebase console under Database > Rules

{
  "rules": {
    // Users data - only authenticated users can read/write their own data
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    
    // Sections data - public read, admin write
    "sections": {
      ".read": true,
      ".write": "auth != null && auth.token.admin == true",
      "$sectionId": {
        "subjects": {
          ".read": true,
          ".write": "auth != null && auth.token.admin == true",
          "$subjectId": {
            "contents": {
              ".read": true,
              ".write": "auth != null && auth.token.admin == true"
            }
          }
        }
      }
    },
    
    // User progress tracking (if you want to implement it later)
    "user_progress": {
      "$uid": {
        ".read": "$uid === auth.uid || (auth != null && auth.token.admin == true)",
        ".write": "$uid === auth.uid || (auth != null && auth.token.admin == true)"
      }
    },
    
    // Public configurations
    "config": {
      ".read": true,
      ".write": "auth != null && auth.token.admin == true"
    }
  }
}

// Additional Firebase Functions for setting admin claims
// You'll need to deploy this as a Firebase Function

/*
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  // Check if the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to set admin claims.');
  }

  // Check if the current user is already an admin (optional security check)
  const currentUserToken = await admin.auth().getUser(context.auth.uid);
  if (!currentUserToken.customClaims?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Must be an admin to set admin claims.');
  }

  try {
    // Set custom claims
    await admin.auth().setCustomUserClaims(data.uid, { admin: true });
    return { message: 'Admin claim set successfully' };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Error setting admin claim: ' + error.message);
  }
});

// Alternative: Set admin claim based on email
exports.setAdminByEmail = functions.https.onCall(async (data, context) => {
  const adminEmails = ['admin@yourdomain.com']; // Replace with your admin emails
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
  }

  if (adminEmails.includes(context.auth.token.email)) {
    try {
      await admin.auth().setCustomUserClaims(context.auth.uid, { admin: true });
      return { message: 'Admin claim set successfully' };
    } catch (error) {
      throw new functions.https.HttpsError('internal', 'Error setting admin claim: ' + error.message);
    }
  } else {
    throw new functions.https.HttpsError('permission-denied', 'Email not authorized for admin access.');
  }
});
*/
