# AllProperly MVP

A React TypeScript application for property management, built with Vite and Firebase.

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

### How to Run the App Locally

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd allproperly-mvp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration values (see Firebase Setup section below)

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5173`

---

## Firebase Connection Setup

### Required Environment Variables

Create a `.env` file in the root directory with these variables:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### How to Connect Firebase

1. **Create a Firebase project:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Create a project" and follow the setup wizard

2. **Enable required services:**
   - Authentication: Enable Email/Password and any other providers you need
   - Firestore Database: Create a database in production mode
   - Storage: If you plan to store images/files

3. **Get your configuration:**
   - Go to Project Settings → General → Your apps
   - Click on the web app icon and copy the config values
   - Add these values to your `.env` file

4. **Firebase configuration:**
   - The Firebase setup is located in `src/services/firebase.ts`
   - Make sure to configure Firestore security rules for your app

---

## Available Scripts

Add these scripts to your `package.json`:

```json
"scripts": {
  "start": "react-scripts start",
  "build": "react-scripts build", 
  "lint": "eslint ./src",
  "format": "prettier --write ."
}
```

### Current Project Scripts

The project currently uses Vite, so the available commands are:

- **`npm run dev`** — Start development server with hot reload
- **`npm run build`** — Build for production (TypeScript compilation + Vite build)
- **`npm run lint`** — Check code for ESLint errors
- **`npm run preview`** — Preview production build locally

### Recommended Additional Scripts

For complete development workflow, consider adding:

- **`npm run format`** — Format code with Prettier (requires installing prettier)
- **`npm start`** — Alternative to `npm run dev` for consistency

---

## Project Structure & Standards

### Component Documentation

For each component:
- **Purpose:** Briefly describe what the component does.
- **Props:** List all props and their types.
- **Edge Cases:** Mention any edge cases handled or to consider.

**Example:**

```tsx
// Component: TaskCard
// Purpose: Renders a task with a checkbox and due date.
// Props: 
//   - task (TaskObject): The task data to display.
// Edge Cases: 
//   - Handles missing due date.
//   - TODO: Add delete confirmation.
```

---

### Code Standards

- **Formatting:** Uses `.prettierrc` for consistent code style (indentation, quotes, semicolons).
- **Linting:** Uses ESLint for rules (e.g., no unused variables).
- **TypeScript:** Enforced via TSLint/ESLint.
- **Logic Separation:**
  - UI in `/components`
  - Data-fetching in `/services`
  - Firebase setup in `firebase.js`
  - Context/state logic in `/contexts`

---

### Architecture

```
src/
├── components/          # Reusable UI components
├── pages/              # Page-level components  
├── services/           # API calls and external services
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── assets/             # Static assets (images, etc.)
```

---

## Environment Setup

### .env.example File

Create a sample `.env.example` file with:

```
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_ESTAED_TOKEN=
```

**Security Notes:**
- Never commit the actual `.env` file
- Store the real `.env` values in Bitwarden
- Add `.env` to your `.gitignore` file

---

## Development Workflow

1. **Pull latest changes** from the main branch
2. **Create a feature branch** for your work
3. **Install dependencies** if package.json changed
4. **Set up environment variables** if first time setup
5. **Run the development server** with `npm run dev`
6. **Make your changes** following the coding standards
7. **Test your changes** thoroughly
8. **Run linting** with `npm run lint` before committing

---

**Tip:**  
Document each component with purpose, props, and edge cases in code comments for maintainability.