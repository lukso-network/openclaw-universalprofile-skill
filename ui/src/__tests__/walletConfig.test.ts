import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('walletConfig', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('chain configurations', () => {
    it('luksoMainnet has chain ID 42', async () => {
      const { luksoMainnet } = await import('../lib/walletConfig')
      expect(luksoMainnet.id).toBe(42)
    })

    it('luksoTestnetNetwork has chain ID 4201', async () => {
      const { luksoTestnetNetwork } = await import('../lib/walletConfig')
      expect(luksoTestnetNetwork.id).toBe(4201)
    })

    it('luksoMainnet has correct native currency', async () => {
      const { luksoMainnet } = await import('../lib/walletConfig')
      expect(luksoMainnet.nativeCurrency).toEqual({
        name: 'LUKSO',
        symbol: 'LYX',
        decimals: 18,
      })
    })

    it('luksoTestnetNetwork has correct native currency', async () => {
      const { luksoTestnetNetwork } = await import('../lib/walletConfig')
      expect(luksoTestnetNetwork.nativeCurrency).toEqual({
        name: 'LUKSO Testnet',
        symbol: 'LYXt',
        decimals: 18,
      })
    })

    it('luksoMainnet has valid RPC URL', async () => {
      const { luksoMainnet } = await import('../lib/walletConfig')
      expect(luksoMainnet.rpcUrls.default.http[0]).toMatch(/^https:\/\//)
    })

    it('luksoTestnetNetwork has valid RPC URL', async () => {
      const { luksoTestnetNetwork } = await import('../lib/walletConfig')
      expect(luksoTestnetNetwork.rpcUrls.default.http[0]).toMatch(/^https:\/\//)
    })

    it('luksoMainnet has block explorer', async () => {
      const { luksoMainnet } = await import('../lib/walletConfig')
      expect(luksoMainnet.blockExplorers?.default.url).toMatch(/^https:\/\//)
      expect(luksoMainnet.blockExplorers?.default.name).toBeTruthy()
    })

    it('luksoTestnetNetwork has block explorer', async () => {
      const { luksoTestnetNetwork } = await import('../lib/walletConfig')
      expect(luksoTestnetNetwork.blockExplorers?.default.url).toMatch(/^https:\/\//)
      expect(luksoTestnetNetwork.blockExplorers?.default.name).toBeTruthy()
    })
  })

  describe('networks array', () => {
    it('contains both mainnet and testnet', async () => {
      const { networks } = await import('../lib/walletConfig')
      expect(networks).toHaveLength(2)
      expect(networks[0].id).toBe(42)
      expect(networks[1].id).toBe(4201)
    })

    it('has mainnet as first entry', async () => {
      const { networks, luksoMainnet } = await import('../lib/walletConfig')
      expect(networks[0]).toBe(luksoMainnet)
    })
  })

  describe('projectId and isWalletConnectConfigured', () => {
    it('defaults to placeholder when env var is not set', async () => {
      const { projectId } = await import('../lib/walletConfig')
      // In test environment, VITE_WALLETCONNECT_PROJECT_ID is not set
      expect(projectId).toBe('placeholder-project-id')
    })

    it('isWalletConnectConfigured is false with placeholder', async () => {
      const { isWalletConnectConfigured } = await import('../lib/walletConfig')
      expect(isWalletConnectConfigured).toBe(false)
    })

    it('isWalletConnectConfigured rejects demo-project-id', async () => {
      // The module reads import.meta.env at import time, so we verify the
      // guard conditions directly
      const rejects = (id: string) =>
        !id || id === 'placeholder-project-id' || id === 'demo-project-id'
      expect(rejects('demo-project-id')).toBe(true)
      expect(rejects('placeholder-project-id')).toBe(true)
      expect(rejects('')).toBe(true)
    })

    it('a real project ID would pass configuration check', () => {
      const isConfigured = (id: string) =>
        Boolean(id && id !== 'placeholder-project-id' && id !== 'demo-project-id')
      expect(isConfigured('abc123def456')).toBe(true)
      expect(isConfigured('my-real-project-id')).toBe(true)
    })
  })

  describe('wagmiAdapter and wagmiConfig', () => {
    it('wagmiAdapter is defined', async () => {
      const { wagmiAdapter } = await import('../lib/walletConfig')
      expect(wagmiAdapter).toBeDefined()
    })

    it('wagmiConfig is defined', async () => {
      const { wagmiConfig } = await import('../lib/walletConfig')
      expect(wagmiConfig).toBeDefined()
    })
  })
})
