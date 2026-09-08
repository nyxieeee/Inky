# Inky — Personal E-Signature & Document Management

> Fast, lightweight, foldable-first personal e-signature web app. Upload, sign, place reusable signatures, manage recipients, and receive documents via shareable inbox links.

---

## 🏗 Architecture & File Structure

Inky is structured as a clean standalone Vite application (identical to **Worklane**):

```
inky/
├── public/                  # Public assets, webmanifest, fonts
├── src/
│   ├── assets/              # Branding marks, logos, graphics
│   ├── components/          # Core screen & feature components
│   │   ├── modals/          # Dedicated modal dialogs
│   │   │   ├── ConfirmModal.tsx
│   │   │   ├── ShareInboxModal.tsx
│   │   │   └── SignaturePadModal.tsx
│   │   ├── ui/              # Reusable design system atoms
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   └── Card.tsx
│   │   ├── Dashboard.tsx    # Document queue & quick actions
│   │   ├── FoldableLayout.tsx # Dual-screen & foldable layout container
│   │   ├── HistoryView.tsx  # Completed & audit document history
│   │   ├── InboundPortal.tsx # External sender submission portal
│   │   ├── MultiSignerPanel.tsx # Multi-signer routing & sequence manager
│   │   ├── PdfViewer.tsx    # Canvas PDF renderer & field drag-and-drop
│   │   └── Toast.tsx        # Animated notification system
│   ├── lib/                 # Client libraries & utilities
│   │   ├── api.ts           # API client
│   │   ├── apiClient.ts     # Direct endpoint fetchers
│   │   ├── pdf.ts           # Coordinate normalization & PDF geometry
│   │   └── storage.ts       # LocalStorage & IndexedDB helpers
│   ├── services/            # Dedicated service layer
│   ├── store/               # Reactive Zustand state stores
│   │   ├── useDocumentStore.ts
│   │   ├── useFoldableStore.ts
│   │   ├── useSignatureStore.ts
│   │   └── useToastStore.ts
│   ├── styles/              # Theme tokens & custom styling
│   │   └── theme.css
│   ├── types.ts             # Central domain & UI type declarations
│   ├── utils.ts             # Helper utilities (cn, formatting, download)
│   ├── vite-env.d.ts        # Ambient declarations & asset typings
│   ├── App.tsx              # Root orchestrator & tab routing
│   └── main.tsx             # Application entrypoint
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

---

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
npm run dev
```

### Build Production Bundle
```bash
npm run build
```
