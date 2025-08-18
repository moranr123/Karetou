# Karetou Admin Panel

A comprehensive admin panel for managing the Karetou mobile application, built with React, TypeScript, and Material-UI.

## Features

### 🔐 Authentication
- Secure admin login system
- Protected routes and session management
- User role-based access control

### 📊 Dashboard
- Real-time statistics and metrics
- Overview of users and businesses
- Quick action buttons for common tasks
- Recent activity tracking

### 🏢 Business Approvals
- Review pending business registrations
- Approve or reject applications with reasons
- View business details and documentation
- Filter by status (Pending, Approved, Rejected)

### 👥 User Management
- View all registered users
- Edit user information
- Search and filter users
- Delete user accounts
- Track business ownership status

### 🏪 Business Management
- Comprehensive business listing
- Edit business information
- Search and filter businesses
- Status management (Pending, Approved, Rejected)
- Delete business records

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **UI Framework**: Material-UI (MUI) v5
- **Backend**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Routing**: React Router v6
- **State Management**: React Context API

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project setup

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd admin-panel
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a Firebase project
   - Enable Authentication and Firestore
   - Update the Firebase configuration in `src/firebase.ts`

4. Start the development server:
```bash
npm start
```

The admin panel will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   └── Layout.tsx          # Main layout with sidebar navigation
├── contexts/
│   └── AuthContext.tsx     # Authentication context
├── pages/
│   ├── Dashboard.tsx       # Main dashboard with statistics
│   ├── Login.tsx          # Admin login page
│   ├── BusinessApprovals.tsx  # Business approval management
│   ├── UserManagement.tsx     # User account management
│   └── BusinessManagement.tsx # Business record management
├── firebase.ts            # Firebase configuration
└── App.tsx               # Main application component
```

## Firebase Collections

### Users Collection
```typescript
interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
  hasBusinessRegistration: boolean;
  businessId?: string;
}
```

### Businesses Collection
```typescript
interface Business {
  id: string;
  businessName: string;
  businessOwner: string;
  selectedType: string;
  businessHours: string;
  contactNumber: string;
  optionalContactNumber?: string;
  businessAddress: string;
  permitNumber: string;
  registrationDate: string;
  status: 'pending' | 'approved' | 'rejected';
  userId: string;
  userEmail: string;
  permitPhoto: string;
  frontIDPhoto: string;
  backIDPhoto: string;
}
```

## Admin Features

### Business Approval Workflow
1. **Pending Review**: New business registrations appear in the pending tab
2. **Review Process**: Admins can view business details and documentation
3. **Decision**: Approve or reject with optional rejection reason
4. **Status Update**: Business status is updated in Firestore
5. **Notification**: Business owners are notified of the decision

### User Management
- View all registered users
- Edit user profile information
- Track which users have business registrations
- Delete user accounts (with confirmation)

### Business Management
- Comprehensive view of all businesses
- Filter by approval status
- Search by business name or owner
- Edit business information
- Delete business records

## Security Considerations

- All routes are protected with authentication
- Admin credentials should be managed securely
- Firebase security rules should be configured properly
- Sensitive operations require confirmation

## Deployment

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

### Other Platforms
The admin panel can be deployed to any static hosting service:
- Vercel
- Netlify
- AWS S3
- GitHub Pages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.
