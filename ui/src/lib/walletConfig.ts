import { createStorage } from 'wagmi'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'

// Get projectId from environment
// A valid project ID is required for WalletConnect to work
// Get one from https://cloud.reown.com/
const PLACEHOLDER_PROJECT_ID = 'placeholder-project-id'
export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || PLACEHOLDER_PROJECT_ID

// Check if WalletConnect is properly configured (not using placeholder)
export const isWalletConnectConfigured = Boolean(
  projectId &&
  projectId !== PLACEHOLDER_PROJECT_ID &&
  projectId !== 'demo-project-id'
)

// Define LUKSO chains for AppKit
export const luksoMainnet: AppKitNetwork = {
  id: 42,
  name: 'LUKSO',
  nativeCurrency: { name: 'LUKSO', symbol: 'LYX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.lukso.network'] },
  },
  blockExplorers: {
    default: { name: 'LUKSO Explorer', url: 'https://explorer.execution.mainnet.lukso.network' },
  },
}

export const luksoTestnetNetwork: AppKitNetwork = {
  id: 4201,
  name: 'LUKSO Testnet',
  nativeCurrency: { name: 'LUKSO Testnet', symbol: 'LYXt', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lukso.network'] },
  },
  blockExplorers: {
    default: { name: 'LUKSO Testnet Explorer', url: 'https://explorer.execution.testnet.lukso.network' },
  },
}

export const baseNetwork: AppKitNetwork = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
}

export const ethereumNetwork: AppKitNetwork = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://eth.llamarpc.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
}

// All supported networks
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [luksoMainnet, baseNetwork, ethereumNetwork, luksoTestnetNetwork]

// Create Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  storage: typeof window !== 'undefined' ? createStorage({
    storage: window.localStorage,
  }) : undefined,
  ssr: false,
  projectId,
  networks,
})

// Export wagmi config for use in components
export const wagmiConfig = wagmiAdapter.wagmiConfig
