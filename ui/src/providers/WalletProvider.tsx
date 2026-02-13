import { type ReactNode, useEffect, useState } from 'react'
import { createAppKit, type AppKit } from '@reown/appkit/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiAdapter, projectId, networks, luksoMainnet, isWalletConnectConfigured } from '../lib/walletConfig'

// Setup query client
const queryClient = new QueryClient()

// Track AppKit instance
let appKitInstance: AppKit | null = null

// App metadata
const metadata = {
  name: 'OpenClaw Authorize',
  description: 'Authorize OpenClaw as a controller for your Universal Profile',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://emmet-bot.github.io',
  icons: ['https://universalprofile.cloud/images/up-logo.png'],
}

// Wallet IDs from WalletConnect Explorer that support LUKSO (chain 42)
// Verified via: https://explorer-api.walletconnect.com/v3/wallets?chains=eip155:42
const LUKSO_COMPATIBLE_WALLETS = {
  tokenPocket: '20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66',
  metaMask: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
  trustWallet: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
  safePal: '0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150',
}

// Initialize AppKit (only once)
function initializeAppKit() {
  if (appKitInstance || typeof window === 'undefined') return

  // Skip AppKit initialization if no valid project ID
  if (!isWalletConnectConfigured) {
    console.warn(
      '[WalletProvider] WalletConnect not configured. ' +
      'Set VITE_WALLETCONNECT_PROJECT_ID in your environment. ' +
      'Get a project ID from https://cloud.reown.com/'
    )
    return
  }

  try {
    appKitInstance = createAppKit({
      adapters: [wagmiAdapter],
      projectId,
      networks,
      defaultNetwork: luksoMainnet,
      metadata,
      features: {
        analytics: false,
        email: false,
        socials: false,
      },
      themeMode: 'light',
      themeVariables: {
        '--w3m-accent': '#FE005B', // LUKSO pink
        '--w3m-border-radius-master': '8px',
      },
      // Feature wallets that support LUKSO chain 42
      featuredWalletIds: [
        LUKSO_COMPATIBLE_WALLETS.tokenPocket,
        LUKSO_COMPATIBLE_WALLETS.metaMask,
        LUKSO_COMPATIBLE_WALLETS.trustWallet,
        LUKSO_COMPATIBLE_WALLETS.safePal,
      ],
      // Custom wallet entry for UP Browser Extension (desktop only)
      customWallets: [
        {
          id: 'up-browser-extension',
          name: 'Universal Profile Extension',
          homepage: 'https://my.universalprofile.cloud',
          image_url: 'https://universalprofile.cloud/images/up-logo.png',
          webapp_link: 'https://chromewebstore.google.com/detail/universal-profiles/abpickdkkbnbcoepogfhkhennhfhehfn',
        },
      ],
    })
  } catch (error) {
    console.error('Failed to initialize AppKit:', error)
  }
}

/** Get the AppKit instance for opening the modal */
export function getAppKitModal() {
  return appKitInstance
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    initializeAppKit()
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
