# 🖋 Inky — Organic, Foldable-First Personal E-Signature Platform

> **A fast, privacy-first personal e-signature web app built for modern and foldable devices.**  
> Sign documents in seconds, sequence multiple signers, receive files via public inbound drop links, manage recipient & sender inboxes, and dispatch signing requests for **$0.00** using direct email and native device sharing.

[![Full Architectural Specification](https://img.shields.io/badge/Architecture%20Plan-esign--app--plan.md-5C7356?style=for-the-badge&logo=markdown)](./esign-app-plan.md)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime%20%26%20RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

---

## 📖 Quick Links
- 📑 **[Read the Full Technical Architecture Plan (`esign-app-plan.md`)](./esign-app-plan.md)** — Comprehensive documentation covering system design, database schemas, Row Level Security (RLS) policies, data flow diagrams (DFDs), and foldable device adaptations.
- 🗄️ **[Database Schema (`supabase/schema.sql`)](./supabase/schema.sql)** — Base PostgreSQL schema ready to execute in the Supabase SQL editor.
- 🔄 **[Database Migrations (`supabase/`)](./supabase/)** — Incremental migrations for Realtime, RLS security isolation, signed notifications, and recipient workflow.
- ⚙️ **[Environment Variables (`.env.example`)](./.env.example)** — Supabase configuration template.

---

## ✨ Key Features & Capabilities

### 📄 1. High-Performance Document Signing & Text Engine
- **Sub-10-Second Signing**: Drop your default saved signature with a single tap.
- **Client-Side PDF Rendering**: High-fidelity, vector-crisp rendering powered by `pdfjs-dist` without uploading files to third-party document processing servers.
- **High-Resolution 288 DPI PDF Flattening**: Live browser-side PDF baking via `pdf-lib` embeds signatures, dates, and custom fonts into permanent, print-ready PDF bytes upon download or export.
- **0ms Latency Text Engine (`FastTextInput`)**:
  - Independent local state eliminates keystroke lag and prevents character jumbling or dropped letters.
  - Automatic 150ms debouncing for storage persistence with immediate sync on `Enter` or `blur`.
  - Event isolation prevents text selection from accidentally dragging fields across the canvas.
- **Professional Document Typography**:
  - Curated fonts spanning formal document styles (**Inter**, **Geist**, **Arial**, **Times New Roman**, **EB Garamond**) and expressive calligraphy scripts (**Dancing Script**, **Caveat**, etc.).
  - Floating customization toolbar allows switching fonts with live previews in both Queue Editor and Signer Portal.

### ✍️ 2. Reusable Signature Studio & Past Signatures
- **Creation Modes**:
  - **Draw**: Pressure-sensitive stroke smoothing via HTML5 Canvas.
  - **Type**: 14+ curated fonts with instant visual previews.
  - **Upload**: PNG/JPG signature image extraction with automatic background removal.
- **Past Signatures & Quick-Sign**:
  - "Past Signatures" tab maintains saved signatures with 1-click placement.
  - Direct "Stamp My Sig" button automatically applies your most recent or default signature to the document.
  - Custom signature renaming, default toggling, and deletion controls.

### 🌐 3. Zero-Login Public Signer Portal (`/sign/:token`)
- **Frictionless External Signing**: Recipients review and sign assigned fields without creating accounts or entering passwords.
- **Floating Sticky Action Bar**: Bottom-centered toolbar (`+ Signature Field`, `Stamp My Sig`, `+ Date`, `+ Text`) follows the user as they scroll multi-page documents.
- **Contextual Field Customization**:
  - Click any text field to edit text and customize font families via floating toolbar.
  - Corner resize handles and drag-to-reposition indicators.
- **Edit & Re-sign Support**: Allows signers to reopen a completed document anytime to make adjustments or replace signatures.
- **True Flattened PDF Export**: Both the top-bar "Export" and post-signing "Download Signed Document" buttons deliver fully flattened PDFs with all signatures baked in.

### 📬 4. Unified Inbox (Incoming & Outgoing)
- **"To Sign" Sub-Tab**:
  - Displays incoming document requests sent directly to your email.
  - 1-click "Sign Now" or "View" navigation with status badges (`Action Required` / `Signed`).
  - Option to permanently delete signing requests from the inbox.
- **"Signed Documents" Sub-Tab**:
  - Notifies document senders in real time when recipients complete signatures.
  - Status indicators (`Fully Signed` vs. `Partially Signed`), unread badge counters, and mark-all-as-read options.
- **"Upload Links" Sub-Tab**:
  - Create and manage public inbound PDF drop links (`/inbox-submit/:token`) with custom titles, expiry hours, and usage limits.

### 👥 5. Multi-Signer Sequencing & Field Tagging
- **Signing Order Sequencing**: Assign signers in order (Signer 1, Signer 2, etc.) or parallel signing.
- **Color-Coded Canvas Fields**:
  - 🟧 **Signer 1**: Terracotta (`#C18C5D`)
  - 🟩 **Signer 2**: Moss Green (`#5D7052`)
  - 🟨 **Signer 3**: Warm Ochre (`#D99E4B`)
  - 🟦 **Signer 4+**: Slate Blue (`#4E5F70`)
- **Tamper-Resistant Field Sealing**:
  - Completed recipient signatures are automatically locked and badged (`Lock` / `ShieldCheck`) to prevent movement or accidental modification.
  - Strict session isolation guarantees signature data never bleeds across documents or signers.

### 🚀 6. Zero-Cost ($0.00) Dispatch Engine
- **Direct `mailto:` Trigger**: 1-click button opens your default email client (Gmail, Apple Mail, Outlook) pre-filled with the recipient's address, subject line, and personal signing link.
- **Native Device Share Sheet (`navigator.share`)**: Send signing links directly via **WhatsApp, Slack, Telegram, Signal, or Messages** on mobile and foldable devices.
- **1-Click Copy Link**: Instant clipboard copy with visual toast confirmation.

### 📱 7. Foldable & Mobile-First Design
- **Samsung Galaxy Z Fold Tested**: Adaptive layout tailored for narrow cover screens (~280px–344px) and expanded dual-screen tablet views without clipping or horizontal overflow.
- **Wabi-Sabi Paper & Ink Aesthetic**: Calming organic tones (clay, loam, moss, terracotta), custom pill controls, subtle textures, dark/light modes, and Framer Motion micro-animations.

### 🔒 8. Dual-Tier Architecture (Offline-First + Supabase Cloud Sync)
- **100% Local-First Offline Mode**: Operates out of the box using `IndexedDB` and `localStorage`. No internet connection or cloud account required.
- **Optional Supabase Cloud Sync**: Connect Supabase for cross-device synchronization, PostgreSQL Row Level Security (RLS), and Realtime notifications via `realtimeService`.

---

## 🏗 Directory Structure

```
inky/
├── public/                       # Favicon, icons, webmanifest
├── src/
│   ├── assets/                   # Branding marks and logos
│   ├── components/
│   │   ├── modals/
│   │   │   ├── AuthModal.tsx         # Supabase magic link & password modal
│   │   │   ├── ConfirmModal.tsx      # Deletion & reset confirmations
│   │   │   ├── ShareInboxModal.tsx   # Inbound drop link generator
│   │   │   └── SignaturePadModal.tsx # Draw/Type/Upload studio & Past Signatures
│   │   ├── ui/
│   │   │   ├── Badge.tsx             # Theme badges
│   │   │   ├── Button.tsx            # Organic buttons
│   │   │   ├── Card.tsx              # Organic paper cards
│   │   │   ├── Dropdown.tsx          # Custom wabi-sabi paper dropdown popover
│   │   │   └── FastTextInput.tsx     # 0ms latency debounced text input component
│   │   ├── Dashboard.tsx         # Document queues (Drafts, Sent, Completed)
│   │   ├── ErrorBoundary.tsx     # Global React error boundary
│   │   ├── FoldableLayout.tsx    # Responsive dual-screen container & navbar
│   │   ├── HistoryView.tsx       # Completed documents & on-the-fly signed PDF export
│   │   ├── InboundPortal.tsx     # Public external PDF upload portal (/inbox-submit/:token)
│   │   ├── LoginPage.tsx         # Full-page authentication view
│   │   ├── MultiSignerPanel.tsx  # Recipient sequencing, mailto & share actions
│   │   ├── PdfViewer.tsx         # PDF canvas, floating toolbar, font selector & field assignment
│   │   ├── SignerAuthGate.tsx    # Recipient verification gate
│   │   ├── SignerPortal.tsx      # Public zero-login recipient signing portal (/sign/:token)
│   │   └── Toast.tsx             # Theme-matched notifications
│   ├── lib/
│   │   ├── pdf.ts                # PDF coordinate math & 288 DPI signature flattening
│   │   ├── storage.ts            # IndexedDB binary PDF & localStorage management
│   │   └── supabase.ts           # Supabase client & environment detection
│   ├── services/
│   │   ├── deliveryService.ts    # Multi-signer links, mailto dispatch & signing portal sync
│   │   ├── documentService.ts    # Document CRUD, cloud storage & flattening
│   │   ├── emailService.ts       # Automated completion & reminder dispatch
│   │   ├── inboxService.ts       # Inbound links & external submissions
│   │   ├── notificationService.ts# Sender inbox signed document notifications
│   │   ├── realtimeService.ts    # Supabase Realtime postgres_changes listeners
│   │   ├── signatureService.ts   # Saved signatures management
│   │   └── signingRequestService.ts # Recipient "To Sign" inbox service
│   ├── store/
│   │   ├── useAuthStore.ts       # Supabase auth session & user state
│   │   ├── useDocumentStore.ts   # Active documents & fields state
│   │   ├── useFoldableStore.ts   # Screen dimension & hinge watcher
│   │   ├── useSignatureStore.ts  # Signature pad state
│   │   └── useToastStore.ts      # Global notifications
│   ├── styles/
│   │   └── theme.css             # Organic paper & ink design system tokens
│   ├── types.ts                  # Central domain & UI TypeScript interfaces
│   ├── utils.ts                  # Canvas trimming, date formatting & image processing
│   ├── App.tsx                   # Main app container & public portal routing
│   └── main.tsx                  # React DOM root
├── supabase/
│   ├── schema.sql                # Base PostgreSQL schema, RLS & storage buckets
│   ├── migration_complete_signing_workflow.sql
│   ├── migration_realtime.sql
│   ├── migration_security_isolation.sql
│   ├── migration_signed_notifications.sql
│   └── migration_signer_access.sql
├── .env.example                  # Supabase environment variables template
├── esign-app-plan.md             # Comprehensive architecture plan
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally (Offline Mode)
```bash
npm run dev
```
Inky will start at `http://localhost:3000`. By default, it runs completely in **offline-first local mode** using your browser's `IndexedDB`.

### 3. Connect Supabase (Optional)
To enable multi-device sync, realtime alerts, and public link submissions:
1. Create a free project at [supabase.com](https://supabase.com).
2. Run the SQL script from [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase **SQL Editor**, followed by any migrations in [`supabase/`](./supabase/).
3. Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
4. Restart `npm run dev`. Click **Sign In** to log in via Magic Link or password.

### 4. Build for Production
```bash
npm run build
```
Type-checks with `tsc` and compiles optimized production assets via `vite build`.

---

## 📜 License
Private & Proprietary — Developed for Uno / Nyxie.
