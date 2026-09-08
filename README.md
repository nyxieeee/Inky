# 🖋 Inky — Organic, Foldable-First Personal E-Signature

> **A fast, privacy-first personal e-signature web app built for modern devices.**  
> Sign documents in seconds, sequence multiple signers, receive files via public inbound drop links, and dispatch signing requests for **$0.00** using direct email and native device sharing.

[![Full Architectural Specification](https://img.shields.io/badge/Architecture%20Plan-esign--app--plan.md-5C7356?style=for-the-badge&logo=markdown)](./esign-app-plan.md)

---

## 📖 Quick Links
- 📑 **[Read the Full Technical Architecture Plan (`esign-app-plan.md`)](./esign-app-plan.md)** — Comprehensive documentation covering system design, database schemas, Row Level Security (RLS) policies, data flow diagrams (DFDs), and foldable device adaptations.
- 🗄️ **[Database Schema (`supabase/schema.sql`)](./supabase/schema.sql)** — SQL schema ready to execute in the Supabase SQL editor.
- ⚙️ **[Environment Variables (`.env.example`)](./.env.example)** — Supabase configuration keys.

---

## ✨ Key Features

### 📄 Fast, Frictionless Document Signing
- **Sub-10-Second Signing**: Drop your default saved signature with a single tap.
- **Client-Side PDF Rendering**: High-fidelity, vector-crisp rendering powered by `pdfjs-dist` without uploading files to third-party document processing services.
- **Multi-Page Support**: Page thumbnail navigation, zoom controls, and drag-and-drop field positioning.

### ✍️ Reusable Signature Studio
- **Multiple Creation Modes**:
  - **Draw**: Natural pressure-sensitive stroke smoothing via HTML5 Canvas.
  - **Type**: 14+ curated fonts spanning professional typography (**Inter**, **Geist**, **Arial**, **Times New Roman**, **EB Garamond**) and elegant calligraphy scripts (**Caveat**, **Dancing Script**, **Great Vibes**, **Alex Brush**).
  - **Upload**: PNG/JPG signature image extraction with automatic background removal.
- **Custom Signature Renaming**: Label, organize, and toggle your default signature.

### 👥 Multi-Signer Sequencing & Field Tagging
- **Signing Order Sequencing**: Assign signers in order (Signer 1, Signer 2, etc.) or in parallel.
- **Color-Coded Canvas Fields**: Visual color indicators indicate who signs where:
  - 🟧 **Signer 1**: Terracotta (`#C18C5D`)
  - 🟩 **Signer 2**: Moss Green (`#5D7052`)
  - 🟨 **Signer 3**: Warm Ochre (`#D99E4B`)
  - 🟦 **Signer 4+**: Slate Blue (`#4E5F70`)

### 🚀 Zero-Cost, 100% Free Email & Share Sheet Dispatch
Distribute signature requests without paid email APIs or monthly subscriptions:
- **Direct `mailto:` Trigger**: 1-click button opens your default email client (Gmail, Apple Mail, Outlook) pre-filled with the recipient address, subject line, and custom signing link. Never gets blocked by spam filters.
- **Native Device Share Sheet (`navigator.share`)**: Send links directly into **WhatsApp, Slack, Telegram, Signal, or Messages** on mobile and foldable devices.
- **1-Click Copy Link**: Instant clipboard copy with visual feedback.

### 🌐 Zero-Login Public Portals
- **Public Signer Portal (`/sign/:token`)**: External recipients review and sign their assigned fields with guided navigation. No account creation or password required.
- **Public Inbound Drop Portal (`/inbox-submit/:token`)**: Share an inbox link to receive signed PDFs directly from clients or partners with usage limits and expiration controls.

### 📱 Foldable & Mobile-First Design
- **Samsung Galaxy Z Fold Tested**: Adaptive UI tailored for narrow cover screens (~280px–344px) and expanded dual-screen tablet views. Zero horizontal scrollbar glitches or layout clipping.
- **Wabi-Sabi Paper & Ink Aesthetic**: Calming organic tones (clay, loam, moss, terracotta), custom rounded pill controls, subtle textures, and smooth Framer Motion micro-animations.

### 🔒 Dual-Tier Architecture (Offline-First + Supabase Cloud Sync)
- **100% Local-First Offline Mode**: Operates out of the box with `IndexedDB` and `localStorage`. No internet connection or cloud account required.
- **Optional Supabase Cloud Sync**: Connect Supabase to sync documents across your phone, tablet, and desktop with Row Level Security (RLS) ensuring strict data isolation.

---

## 🏗 Directory Structure

```
inky/
├── public/                       # Favicon, icons, webmanifest
├── src/
│   ├── assets/                   # Branding marks and logos
│   ├── components/
│   │   ├── modals/
│   │   │   ├── AuthModal.tsx         # Supabase magic link & password login
│   │   │   ├── ConfirmModal.tsx      # Deletion & reset confirmations
│   │   │   ├── ShareInboxModal.tsx   # Inbound drop link generator
│   │   │   └── SignaturePadModal.tsx # Draw/Type/Upload signature studio
│   │   ├── ui/
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Dropdown.tsx          # Custom wabi-sabi paper dropdown popover
│   │   ├── Dashboard.tsx         # Document queues (To Sign, Pending, Recent)
│   │   ├── FoldableLayout.tsx    # Responsive dual-screen container & navbar
│   │   ├── HistoryView.tsx       # Completed documents & audit log viewer
│   │   ├── InboundPortal.tsx     # Public external PDF upload portal
│   │   ├── MultiSignerPanel.tsx  # Recipient sequencing, mailto & share actions
│   │   ├── PdfViewer.tsx         # PDF canvas, font selector & field assignment
│   │   ├── SignerPortal.tsx      # Public zero-login recipient signing portal
│   │   └── Toast.tsx             # Theme-matched notifications
│   ├── lib/
│   │   ├── pdf.ts                # PDF coordinate math & geometry
│   │   ├── storage.ts            # IndexedDB binary PDF & local storage
│   │   └── supabase.ts           # Supabase client & environment detection
│   ├── services/
│   │   ├── deliveryService.ts    # Multi-signer links, mailto & signing portal
│   │   ├── documentService.ts    # Document CRUD & cloud sync
│   │   ├── inboxService.ts       # Inbound links & external submission
│   │   └── signatureService.ts   # Saved signatures management
│   ├── store/
│   │   ├── useAuthStore.ts       # Supabase auth session & user state
│   │   ├── useDocumentStore.ts   # Active documents & fields state
│   │   ├── useFoldableStore.ts   # Screen dimension & hinge watcher
│   │   ├── useSignatureStore.ts  # Signature pad state
│   │   └── useToastStore.ts      # Global notifications
│   ├── styles/
│   │   └── theme.css             # Organic paper & ink design system tokens
│   ├── types.ts                  # Central domain & UI interfaces
│   ├── utils.ts                  # Canvas trimming & image processing
│   ├── App.tsx                   # Main app & public portal routing
│   └── main.tsx                  # React DOM root
├── supabase/
│   └── schema.sql                # Complete Postgres schema, RLS & storage buckets
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
To enable multi-device sync and public link submissions:
1. Create a free project at [supabase.com](https://supabase.com).
2. Run the SQL script from [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase **SQL Editor**.
3. Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
4. Restart `npm run dev`. Click the **Sync** button in the top navigation to sign in via Magic Link or password.

### 4. Build for Production
```bash
npm run build
```

---

## 📜 License
Private & Proprietary — Developed for Uno / Nyxie.
