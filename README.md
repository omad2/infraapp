# InfraApp
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/omad2/infraapp)

InfraApp is a community-driven mobile application built with React Native and Firebase, designed to empower citizens to report and track local infrastructure issues. Users can submit reports with photos, which are then verified by an AI, approved by administrators, and displayed on a public feed for community visibility and engagement.

## Key Features

-   **User Authentication:** Secure sign-up and login functionality using Firebase Authentication.
-   **AI-Powered Reporting:** Submit reports with photos, categories, descriptions, and geo-location. Image submissions are verified against the selected category using the OpenAI Vision API.
-   **Admin Dashboard:** A protected dashboard for administrators to review, approve, or decline pending reports.
-   **Community Feed:** A public feed displaying all approved reports, where users can upvote to help prioritize issues.
-   **County Leaderboard:** Gamified tracking of which counties have the most completed reports, fostering friendly competition.
-   **User Account & Notifications:** Users can view their report history and receive in-app messages regarding the status of their submissions.
-   **Role-Based Access:** Distinct functionalities for `user` and `admin` roles, managed through Firestore.

## Tech Stack

-   **Framework:** React Native with Expo
-   **Language:** TypeScript
-   **Backend & Database:** Firebase (Authentication, Firestore, Cloud Storage, Cloud Functions)
-   **Routing:** Expo Router (File-based)
-   **AI:** OpenAI API (GPT-4o-mini) for image verification
-   **UI/Styling:** `expo-linear-gradient`, `expo-blur`, and custom components for a modern, dark-themed UI.
-   **Location:** `expo-location` for geo-tagging reports.

## Project Structure

A brief overview of the key directories in the project.

```
omad2-infraapp/
├── app/                  # Main application source code with file-based routing
│   ├── (tabs)/           # Screens for the main tab navigator
│   ├── admin/            # Admin-specific screens and dashboard
│   ├── api/              # API endpoints (image verification, county validation)
│   └── auth/             # Authentication screens (Login, Signup, Forgot Password)
├── components/           # Reusable React components (Buttons, Admin private routes)
├── config/               # Firebase and environment configuration
├── contexts/             # React Context for global state (e.g., AuthContext)
├── functions/            # Firebase Cloud Functions for backend tasks
├── utils/                # Utility functions (Irish county list, random name generator)
└── assets/               # Static assets like fonts and images
```

## Setup and Installation

### 1. Clone the repository
```bash
git clone https://github.com/omad2/infraapp.git
cd infraapp
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Environment Variables
Create a `.env` file in the root of the project and add your Firebase and OpenAI credentials. The API URL should point to your local Expo server for development.

```bash
# .env

# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
EXPO_PUBLIC_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_FIREBASE_MEASUREMENT_ID"

# OpenAI API Key
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

### 4. Set up Firebase User Roles
In your Firestore database, create a `users` collection. User documents are created automatically on signup with a default `role` of `"user"`. To grant admin access, manually update a user's document in Firestore to set their `role` field to `"admin"`.

### 5. Deploy Firebase Functions
The project includes a Cloud Function to automatically delete expired messages from Firestore.

```bash
# Navigate to the functions directory
cd functions

# Install dependencies
npm install

# Deploy the function (requires Firebase CLI)
firebase deploy --only functions
```

### 6. Start the application
```bash
npx expo start
```
This command will start the Expo development server, allowing you to run the app on an iOS simulator, Android emulator, or a physical device using the Expo Go app.

## API Endpoints

The application utilizes Expo's file-based API routes for server-side logic.

-   `POST /api/verify-image`
    -   Accepts a base64 encoded image and a category name.
    -   Uses the OpenAI Vision API to determine if the image content is relevant to the provided category.
    -   Returns: `{ isVerified: boolean }`.

-   `POST /api/validate-county`
    -   Accepts a county name.
    -   Checks the name against a predefined list of valid Irish counties.
    -   Returns: `{ isValid: boolean }`.
