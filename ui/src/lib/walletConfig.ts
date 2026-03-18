import { defineChain, createClient, http } from 'viem'
import { createConfig, createStorage, injected } from '@wagmi/core'
import type { Config } from '@wagmi/core'

// Define LUKSO chains
export const luksoMainnet = defineChain({
  id: 42,
  name: 'LUKSO',
  nativeCurrency: { name: 'LUKSO', symbol: 'LYX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.lukso.network'] },
  },
  blockExplorers: {
    default: { name: 'LUKSO Explorer', url: 'https://explorer.execution.mainnet.lukso.network' },
  },
})

export const luksoTestnetNetwork = defineChain({
  id: 4201,
  name: 'LUKSO Testnet',
  nativeCurrency: { name: 'LUKSO Testnet', symbol: 'LYXt', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lukso.network'] },
  },
  blockExplorers: {
    default: { name: 'LUKSO Testnet Explorer', url: 'https://explorer.execution.testnet.lukso.network' },
  },
  testnet: true,
})

export const baseNetwork = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
})

export const ethereumNetwork = defineChain({
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://ethereum-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
})

// All supported networks (LUKSO first as default)
export const networks = [luksoMainnet, baseNetwork, ethereumNetwork, luksoTestnetNetwork] as const

/**
 * Create a custom wagmi config with all our supported chains.
 * up-modal's built-in config only supports LUKSO chains — we need
 * Ethereum, Base, etc. for cross-chain authorization.
 */
export function createMultiChainWagmiConfig(): Config {
  return createConfig({
    chains: [luksoMainnet, baseNetwork, ethereumNetwork, luksoTestnetNetwork],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    storage: createStorage({
      key: 'up-wagmi',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }),
    client({ chain }) {
      return createClient({ chain, transport: http() })
    },
  }) as unknown as Config
}
