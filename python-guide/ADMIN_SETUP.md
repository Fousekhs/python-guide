# Admin Panel Setup Guide

## Overview
The admin panel allows administrators to create and manage educational content including sections, subjects, and various types of learning materials (theory, multiple choice questions, true/false questions, and code questions).

## Features Created

### 1. Content Management Service (`content.service.ts`)
- **Sections**: Create, update, delete, and reorder sections
- **Subjects**: Manage subjects within sections
- **Content Types**:
  - **Theory Content**: Text-based learning with optional code segments
  - **Multiple Choice Questions**: Questions with multiple options
  - **True/False Questions**: Boolean-based questions
  - **Code Questions**: Programming challenges with test cases and hints

### 2. Admin Panel Component
- **Tabbed Interface**: Organized into Sections, Subjects, and Content tabs
- **Drag & Drop**: Reorder sections and subjects
- **Form Validation**: Comprehensive form validation for all content types
- **Real-time Updates**: Instant feedback and data synchronization

### 3. User Management Service (`user.service.ts`)
- User data management
- Progress tracking
- Statistics calculation

## Setup Instructions

### 1. Firebase Configuration

#### Database Rules
Update your Firebase Realtime Database rules with the content from `firebase-setup.js`:

1. Go to Firebase Console > Your Project > Realtime Database > Rules
2. Replace the existing rules with the rules provided in `firebase-setup.js`
3. Publish the rules

#### Admin Claims Setup
To set admin privileges for users, you have two options:

**Option A: Manual Admin Setup (for initial admin)**
```typescript
// In your browser console, after logging in as the user you want to make admin:
// This requires Firebase Admin SDK or custom functions
```

**Option B: Firebase Functions (Recommended)**
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Initialize Firebase Functions in your project: `firebase init functions`
3. Add the admin claim functions from `firebase-setup.js` to your functions/index.js
4. Deploy functions: `firebase deploy --only functions`

### 2. Application Dependencies
Make sure you have all required Angular Material modules. The admin panel uses:
- MatTabsModule
- MatCardModule
- MatButtonModule
- MatInputModule
- MatSelectModule
- MatCheckboxModule
- MatIconModule
- MatExpansionModule
- MatDialogModule
- MatSnackBarModule
- MatListModule
- MatChipsModule
- DragDropModule (from @angular/cdk)

### 3. Environment Setup
Ensure your `environment.ts` file has the correct Firebase configuration.

### 4. Routing
The admin panel is accessible at `/admin` and is protected by the `AdminGuard`.

## Database Structure

```
├── sections/
│   ├── {sectionId}/
│   │   ├── title: string
│   │   ├── description: string
│   │   ├── order: number
│   │   ├── isPublished: boolean
│   │   └── subjects/
│   │       ├── {subjectId}/
│   │       │   ├── title: string
│   │       │   ├── description: string
│   │       │   ├── order: number
│   │       │   ├── sectionId: string
│   │       │   └── contents/
│   │       │       ├── {contentId}/
│   │       │       │   ├── order: number
│   │       │       │   └── [content-specific fields]
├── users/
│   ├── {userId}/
│   │   ├── email: string
│   │   ├── displayName: string
│   │   └── createdAt: string
└── user_progress/
    ├── {userId}/
    │   ├── {sectionId}/
    │   │   ├── {subjectId}/
    │   │   │   └── {contentId}/
    │   │   │       ├── completed: boolean
    │   │   │       ├── score?: number
    │   │   │       ├── attempts: number
    │   │   │       └── lastAttempt: string
```

## Content Types

### Theory Content
```typescript
{
  title: string;
  content: string;
  codeSegment?: {
    code: string;
    language: string;
    explanation?: string;
  };
  order: number;
}
```

### Multiple Choice Question
```typescript
{
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  explanation?: string;
  order: number;
}
```

### True/False Question
```typescript
{
  question: string;
  correctAnswer: boolean;
  explanation?: string;
  order: number;
}
```

### Code Question
```typescript
{
  question: string;
  starterCode: string;
  solution: string;
  testCases: {
    input: string;
    expectedOutput: string;
    description?: string;
  }[];
  hints?: string[];
  explanation?: string;
  order: number;
}
```

## Making a User Admin

### Method 1: Direct Database Update
1. Go to Firebase Console > Realtime Database
2. Navigate to `users/{userId}`
3. Add a field `isAdmin: true`

### Method 2: Custom Claims (Recommended)
1. Deploy the Firebase Functions from `firebase-setup.js`
2. Call the `setAdminByEmail` function for your admin user
3. The admin claim will be set in the user's token

## Security Considerations

1. **Admin Access**: Only users with admin claims can access the admin panel
2. **Data Validation**: All forms include client-side validation
3. **Firebase Rules**: Database rules prevent unauthorized access
4. **Content Publishing**: Sections can be drafted before publishing

## Next Steps

### Recommended Enhancements
1. **Rich Text Editor**: Integrate a WYSIWYG editor for theory content
2. **Image Upload**: Add support for images in content
3. **Content Preview**: Add preview functionality before publishing
4. **Bulk Operations**: Add bulk import/export features
5. **Analytics**: Add usage analytics and reporting
6. **Content Versioning**: Track content changes over time

### Student-Facing Components
You'll want to create corresponding components for students:
1. **Section Browser**: Display available sections
2. **Subject Viewer**: Show subject content
3. **Question Renderer**: Handle different question types
4. **Progress Tracker**: Show completion status
5. **Code Editor**: For code questions

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify Firebase configuration
3. Ensure all dependencies are installed
4. Check that admin privileges are properly set
5. Verify database rules are correctly configured

The admin panel provides a comprehensive foundation for managing educational content. You can extend it based on your specific requirements.
