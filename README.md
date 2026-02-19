# NEXUS · Web3 Event Ticketing on Algorand

<p align="center">
  <strong>Mint, sell, and verify event tickets as Algorand Standard Assets (ASAs)</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**NEXUS** is a decentralized event ticketing platform built on the [Algorand](https://algorand.com/) blockchain. It enables organizers to create events, mint NFT-style tickets as ASAs, and sell them through an automated vending machine (smart contract). Attendees purchase tickets with ALGO, hold them in their wallet, and present scannable QR codes at the door for verification.

Built to reduce scalping, fraud, and counterfeit tickets while providing **instant settlement**, **on-chain proof of ownership**, and **organizer-controlled admission**.

---

## Features

### For Attendees
- **Browse Marketplace** — Discover events from the global on-chain catalog
- **Purchase Tickets** — Buy NFT tickets with ALGO via Pera Wallet
- **My Tickets** — View owned tickets with downloadable QR codes
- **Secure Proof** — Each ticket is a unique ASA in your wallet

### For Organizers
- **Create Events** — Mint ticket assets with metadata (name, date, venue, price)
- **Auto-Sell System** — Smart contract vending machine handles sales
- **Verify at Door** — Real-time camera or file upload to scan QR codes
- **Mark as Used** — Freeze used tickets on-chain to prevent reuse

### Platform Highlights
| Feature | Description |
|--------|-------------|
| **Algorand ASAs** | Tickets are native blockchain assets |
| **LogicSig Vending** | TEAL smart contract for trustless sales |
| **Freeze Manager** | Organizer can mark tickets as used (freeze) |
| **Pera Wallet** | Mobile & desktop wallet integration |
| **QR Verification** | Live camera + file upload scanning |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4 |
| **Blockchain** | Algorand, algosdk |
| **Wallet** | Pera Wallet Connect |
| **3D Landing** | Spline (React) |
| **QR Scan** | html5-qrcode |
| **Network** | Algorand TestNet (AlgoNode) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Pera Wallet](https://perawallet.io/) (mobile or browser extension)
- Algorand TestNet ALGO ([faucet](https://bank.testnet.algorand.network/))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/nexus-ticketing.git
cd nexus-ticketing

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview   # Preview production build locally
```

---

## Usage

### 1. Connect Wallet
- Install [Pera Wallet](https://perawallet.io/)
- Switch to **Algorand TestNet**
- Fund your wallet with [TestNet ALGO](https://bank.testnet.algorand.network/)
- Click **Connect Wallet** in the app

### 2. Attendee Flow
1. Go to **Marketplace** → browse events
2. Click **Buy** on an event → sign transaction in Pera Wallet
3. Ticket appears in **My Tickets**
4. Open ticket → show QR code at the venue

### 3. Organizer Flow
1. Go to **Create Event** → fill form (name, date, venue, price, supply)
2. Sign asset creation + setup transactions
3. Event appears in Marketplace for buyers
4. At the door: **Verify** → Start Camera → scan attendee QR
5. Click **ADMIT & MARK AS USED** to freeze ticket on-chain

---

## Project Structure

```
src/
├── components/
│   ├── Navbar.jsx
│   ├── WalletConnect.jsx
│   └── ...
├── context/
│   └── AlgorandContext.jsx      # Pera Wallet, algod, indexer
├── pages/
│   ├── SplineLanding.jsx        # 3D landing + Get Started
│   ├── Landing.jsx              # Role selection (Attendee/Organizer)
│   ├── Marketplace.jsx          # Browse & buy events
│   ├── MyTickets.jsx            # Owned tickets + QR
│   ├── CreateEvent.jsx          # Mint tickets + deploy vending
│   ├── OrganizerDashboard.jsx   # Organizer overview
│   └── Verify.jsx               # QR scan + admit
├── utils/
│   └── marketplaceContract.js   # TEAL vending machine
├── App.jsx
├── main.jsx
└── index.css
```

---

## How It Works

### Ticket Creation
1. Organizer submits event details
2. App creates an **ASA** (Algorand Standard Asset) with metadata in `note`
3. Asset uses `freeze` address = organizer (to mark tickets used later)

### Vending Machine (Smart Contract)
- TEAL LogicSig enforces: **Payment (ALGO) + Asset Transfer** in atomic group
- Buyer pays creator → receives 1 unit of ticket asset
- No escrow; contract validates payment and transfer atomically

### Verification
- Attendee shows QR = `{ address, assetId }`
- App checks: Does `address` hold `assetId`? Is it frozen?
- Organizer signs **Asset Freeze** to mark ticket as used

### Data Discovery
- Events found via Indexer: transactions with `note` prefix `TICKET_APP_V3:`
- Metadata (price, venue, date) stored in base64 note

---

## Environment

Runs on **Algorand TestNet** by default:

- **algod**: `https://testnet-api.algonode.cloud`
- **indexer**: `https://testnet-idx.algonode.cloud`
- **Chain ID**: 416002 (TestNet)

To use MainNet, update `AlgorandContext.jsx` and ensure proper configuration.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## Security Notes

- **TestNet only** — Use TestNet for development; MainNet requires audits
- **Freeze Manager** — Only organizer (freeze address) can mark tickets used
- **HTTPS** — Camera for QR scanning requires secure context (HTTPS or localhost)

---

## License

MIT

---

<p align="center">
  <sub>Built on Algorand · Pera Wallet · React</sub>
</p>
