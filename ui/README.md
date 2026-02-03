# Universal Profile Authorization UI

A React-based web application for authorizing OpenClaw as a controller on LUKSO Universal Profiles.

## Features

- 🔗 **Wallet Connection** - Connect via UP Browser Extension
- 🔐 **Permission Presets** - Pre-configured permission levels (Read-Only, Token Operator, Profile Manager, Full Access)
- ⚙️ **Custom Permissions** - Fine-grained permission selection for advanced users
- ⚠️ **Risk Warnings** - Clear warnings for dangerous permissions
- 📱 **QR Code Support** - Generate QR codes for mobile authorization
- 🌙 **Dark Mode** - Automatic dark/light mode based on system preference
- 📱 **Mobile Responsive** - Works on all device sizes

## Tech Stack

- **React 18** - UI Framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **viem** - Ethereum interactions
- **qrcode.react** - QR code generation

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- LUKSO UP Browser Extension (for testing)

### Installation

```bash
cd ui
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## URL Parameters

The UI supports pre-filled values via URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `controller` | Controller address to authorize | `0x123...abc` |
| `preset` | Permission preset to select | `read-only`, `token-operator`, `profile-manager`, `full-access` |
| `chain` | Chain ID | `42` (mainnet), `4201` (testnet) |
| `up` | Universal Profile address (optional) | `0x456...def` |

**Example URL:**
```
https://yourdomain.com/ui/?controller=0x1234...&preset=token-operator&chain=42
```

## Deployment

### GitHub Pages

The UI is configured for automatic deployment to GitHub Pages via GitHub Actions.

1. Push changes to the `main` branch (affecting `ui/` directory)
2. The workflow will automatically build and deploy

**Manual Trigger:**
- Go to Actions → "Deploy UI to GitHub Pages" → "Run workflow"

### Manual Deployment

1. Build the project:
   ```bash
   GITHUB_PAGES=true npm run build
   ```

2. Deploy the `dist/` directory to your hosting provider

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_PAGES` | Set to `'true'` to use GitHub Pages base path | `undefined` |

## Permission Presets

| Preset | Permissions | Use Case |
|--------|-------------|----------|
| **Read-Only** | `STATICCALL`, `EXECUTE_RELAY_CALL` | Viewing profile data |
| **Token Operator** | `CALL`, `TRANSFERVALUE`, `EXECUTE_RELAY_CALL` | Token transfers |
| **Profile Manager** | `SETDATA`, `STATICCALL`, `EXECUTE_RELAY_CALL` | Profile updates |
| **Full Access** | `ALL_PERMISSIONS` | Complete control (⚠️ dangerous) |

## Security Considerations

- Always verify the controller address before authorizing
- Use the minimum necessary permissions
- Critical permissions (CHANGEOWNER, DELEGATECALL) require explicit confirmation
- The UI shows clear risk warnings for dangerous configurations

## Project Structure

```
ui/
├── public/
│   └── lukso-logo.svg
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── ConnectionSection.tsx
│   │   ├── ControllerInfo.tsx
│   │   ├── PermissionSelector.tsx
│   │   ├── RiskWarnings.tsx
│   │   ├── AuthorizeButton.tsx
│   │   ├── SuccessConfirmation.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useWallet.ts
│   │   ├── useAuthorization.ts
│   │   └── index.ts
│   ├── App.tsx
│   ├── constants.ts
│   ├── utils.ts
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.ts
```

## License

MIT
