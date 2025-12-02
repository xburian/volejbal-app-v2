# 🏐 Volleyball Planner

Modern web application for managing volleyball events, tracking participants, and handling payments.

## ✨ Features

### 👤 User Management
- User profiles with optional photos (2MB max)
- Diacritic-insensitive search (e.g., "simon" finds "Šimon")
- Photo upload/change directly in events
- Avatar with fallback to initials

### 📅 Event Management
- Date display in dd.MM.yyyy format
- Inline cost editing with auto-recalculation
- Copy account numbers to clipboard
- QR code regeneration on price changes
- Auto-select first upcoming event

### 💰 Payment Features
- QR code payment generation
- Payment tracking per participant
- Automatic cost per person calculation
- IBAN conversion for Czech accounts

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm or yarn

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set Firebase credentials** (optional):
   Create `.env.local` and add:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-domain
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Open browser:** http://localhost:5173

## 🧪 Testing

```bash
npm test                      # Run tests in watch mode
npm test -- --run             # Run tests once
npm test -- --run --coverage  # Run with coverage report
```

**Test Results:** 41/43 passing (95.3%) ✅  
**Coverage:** 55.93% overall
