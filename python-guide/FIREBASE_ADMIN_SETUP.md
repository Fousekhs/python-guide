# Firebase Admin Claims Setup

## Overview
The user management feature in the admin panel requires Firebase Cloud Functions to properly set custom claims for admin users. Currently, the frontend updates the database directly, but for proper security, you should implement Firebase Cloud Functions.

## Required Setup

### 1. Install Firebase Functions
```bash
firebase init functions
cd functions
npm install firebase-admin
```

### 2. Create Admin Management Functions

Create the following Cloud Functions in your `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Function to promote user to admin
export const promoteUserToAdmin = functions.https.onCall(async (data, context) => {
  // Check if the caller is already an admin
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can promote users');
  }

  const { uid } = data;
  
  try {
    // Set custom admin claim
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    
    // Update user record in database
    await admin.database().ref(`users/${uid}/isAdmin`).set(true);
    
    return { success: true, message: 'User promoted to admin successfully' };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to promote user to admin');
  }
});

// Function to demote user from admin
export const demoteUserFromAdmin = functions.https.onCall(async (data, context) => {
  // Check if the caller is already an admin
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can demote users');
  }

  const { uid } = data;
  
  try {
    // Remove custom admin claim
    await admin.auth().setCustomUserClaims(uid, { admin: false });
    
    // Update user record in database
    await admin.database().ref(`users/${uid}/isAdmin`).set(false);
    
    return { success: true, message: 'Admin privileges removed successfully' };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to remove admin privileges');
  }
});

// Function to get all users with their claims (for admin panel)
export const getAllUsersWithClaims = functions.https.onCall(async (data, context) => {
  // Check if the caller is an admin
  if (!context.auth?.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can view all users');
  }

  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.customClaims?.admin || false,
      createdAt: user.metadata.creationTime
    }));

    return { users };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to fetch users');
  }
});
```

### 3. Update Frontend Services

Once the Cloud Functions are deployed, update the AuthService methods:

```typescript
// Replace the current methods with these:
promoteUserToAdmin(uid: string): Observable<void> {
  const functions = getFunctions();
  const promoteFunction = httpsCallable(functions, 'promoteUserToAdmin');
  return from(promoteFunction({ uid })).pipe(map(() => void 0));
}

demoteUserFromAdmin(uid: string): Observable<void> {
  const functions = getFunctions();
  const demoteFunction = httpsCallable(functions, 'demoteUserFromAdmin');
  return from(demoteFunction({ uid })).pipe(map(() => void 0));
}
```

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

### 5. Set Initial Admin
To create your first admin user, use the Firebase Admin SDK directly:

```javascript
// Run this once in Firebase Console or locally
admin.auth().setCustomUserClaims('YOUR_USER_UID', { admin: true });
```

## Security Rules

Make sure your Firebase Realtime Database rules protect admin operations:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid || auth.token.admin === true",
        ".write": "$uid === auth.uid || auth.token.admin === true"
      }
    },
    "sections": {
      ".read": true,
      ".write": "auth.token.admin === true"
    }
  }
}
```

## Current Implementation Note

The current frontend implementation updates the database directly for demo purposes. In production, always use the Cloud Functions approach for security.
