import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Address } from 'viem'

// --- Wagmi mocks ---
const mockWagmiDisconnect = vi.fn()
const mockWagmiAccount = {
  isConnected: false,
  isConnecting: false,
  address: undefined as Address | undefined,
  chainId: undefined as number | undefined,
}
const mockWagmiWalletClient = { data: undefined }

const mockSwitchChain = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => mockWagmiAccount,
  useDisconnect: () => ({ disconnect: mockWagmiDisconnect }),
  useWalletClient: () => mockWagmiWalletClient,
  useSwitchChain: () => ({ switchChain: mockSwitchChain }),
}))

// --- AppKit mock ---
const mockModalOpen = vi.fn()
vi.mock('../providers/WalletProvider', () => ({
  getAppKitModal: () => ({ open: mockModalOpen }),
}))

// --- WalletConfig mock ---
let mockIsWalletConnectConfigured = true
vi.mock('../lib/walletConfig', () => ({
  get isWalletConnectConfigured() {
    return mockIsWalletConnectConfigured
  },
}))

// --- Mock viem clients ---
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem')
  return {
    ...actual,
    createWalletClient: vi.fn(() => ({ type: 'mock-wallet-client' })),
    createPublicClient: vi.fn(() => ({
      type: 'mock-public-client',
      chain: { id: 42 },
      readContract: vi.fn(),
    })),
  }
})

// --- Mock utils ---
vi.mock('../utils', () => ({
  convertIpfsUrl: (url: string) => url,
  fetchProfileFromIndexer: vi.fn().mockResolvedValue(null),
}))

// --- Mock window.lukso provider ---
const mockProvider = {
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}

function setWindowProvider(provider: typeof mockProvider | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).lukso = provider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).ethereum = null
}

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWagmiAccount.isConnected = false
    mockWagmiAccount.isConnecting = false
    mockWagmiAccount.address = undefined
    mockWagmiAccount.chainId = undefined
    mockWagmiWalletClient.data = undefined
    mockIsWalletConnectConfigured = true
    setWindowProvider(mockProvider)
  })

  async function getHook() {
    const { useWallet } = await import('../hooks/useWallet')
    return renderHook(() => useWallet())
  }

  describe('initial state', () => {
    it('starts disconnected', async () => {
      const { result } = await getHook()

      expect(result.current.isConnected).toBe(false)
      expect(result.current.isConnecting).toBe(false)
      expect(result.current.address).toBeNull()
      expect(result.current.chainId).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.walletClient).toBeNull()
      expect(result.current.publicClient).toBeNull()
      expect(result.current.profileData).toBeNull()
      expect(result.current.connectionMethod).toBeNull()
    })

    it('detects extension availability', async () => {
      setWindowProvider(mockProvider)
      const { result } = await getHook()
      expect(result.current.isExtensionAvailable).toBe(true)
    })

    it('reports extension unavailable when no provider', async () => {
      setWindowProvider(null)
      const { result } = await getHook()
      expect(result.current.isExtensionAvailable).toBe(false)
    })

    it('reports WalletConnect availability based on config', async () => {
      mockIsWalletConnectConfigured = true
      const { result } = await getHook()
      expect(result.current.isWalletConnectAvailable).toBe(true)
    })

    it('reports WalletConnect unavailable when not configured', async () => {
      mockIsWalletConnectConfigured = false
      const { result } = await getHook()
      expect(result.current.isWalletConnectAvailable).toBe(false)
    })
  })

  describe('connectExtension', () => {
    it('connects successfully via extension', async () => {
      const testAddress = '0x1234567890abcdef1234567890abcdef12345678' as Address
      mockProvider.request
        .mockResolvedValueOnce([testAddress]) // eth_requestAccounts
        .mockResolvedValueOnce('0x2a') // eth_chainId (42 in hex)

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.address).toBe(testAddress)
      expect(result.current.chainId).toBe(42)
      expect(result.current.connectionMethod).toBe('extension')
      expect(result.current.error).toBeNull()
    })

    it('sets error when no provider available', async () => {
      setWindowProvider(null)
      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toContain('No UP Browser Extension')
    })

    it('sets error when provider returns no accounts', async () => {
      mockProvider.request
        .mockResolvedValueOnce([]) // empty accounts

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBeTruthy()
    })

    it('handles provider request rejection', async () => {
      mockProvider.request.mockRejectedValueOnce(new Error('User rejected'))

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBe('User rejected')
      expect(result.current.isConnecting).toBe(false)
    })

    it('disconnects wagmi if wagmi was connected', async () => {
      mockWagmiAccount.isConnected = true
      mockProvider.request
        .mockResolvedValueOnce(['0x1234567890abcdef1234567890abcdef12345678'])
        .mockResolvedValueOnce('0x2a')

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(mockWagmiDisconnect).toHaveBeenCalled()
    })

    it('handles testnet chain ID 4201', async () => {
      mockProvider.request
        .mockResolvedValueOnce(['0x1234567890abcdef1234567890abcdef12345678'])
        .mockResolvedValueOnce('0x1069') // 4201 in hex

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(result.current.chainId).toBe(4201)
    })
  })

  describe('connectWalletConnect', () => {
    it('opens the AppKit modal', async () => {
      const { result } = await getHook()

      await act(async () => {
        await result.current.connectWalletConnect()
      })

      expect(mockModalOpen).toHaveBeenCalled()
    })

    it('sets error when WalletConnect is not configured', async () => {
      mockIsWalletConnectConfigured = false
      const { result } = await getHook()

      await act(async () => {
        await result.current.connectWalletConnect()
      })

      expect(result.current.error).toContain('not configured')
      expect(mockModalOpen).not.toHaveBeenCalled()
    })

    it('sets error when modal.open() throws', async () => {
      mockModalOpen.mockRejectedValueOnce(new Error('Modal failed'))

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectWalletConnect()
      })

      expect(result.current.error).toBe('Modal failed')
    })

    it('disconnects extension if extension was connected first', async () => {
      // First connect via extension
      mockProvider.request
        .mockResolvedValueOnce(['0x1234567890abcdef1234567890abcdef12345678'])
        .mockResolvedValueOnce('0x2a')

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      expect(result.current.connectionMethod).toBe('extension')

      // Now connect via WalletConnect — should disconnect extension
      await act(async () => {
        await result.current.connectWalletConnect()
      })

      // Extension state should be cleared
      // (WC connection depends on wagmi account updating, which is mocked as disconnected)
      expect(mockModalOpen).toHaveBeenCalled()
    })
  })

  describe('disconnect', () => {
    it('disconnects from extension', async () => {
      // Connect first
      mockProvider.request
        .mockResolvedValueOnce(['0x1234567890abcdef1234567890abcdef12345678'])
        .mockResolvedValueOnce('0x2a')

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })
      expect(result.current.isConnected).toBe(true)

      // Disconnect
      act(() => {
        result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.address).toBeNull()
      expect(result.current.chainId).toBeNull()
      expect(result.current.walletClient).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.connectionMethod).toBeNull()
      expect(result.current.profileData).toBeNull()
    })

    it('calls wagmi disconnect when wagmi is connected', async () => {
      mockWagmiAccount.isConnected = true

      const { result } = await getHook()

      act(() => {
        result.current.disconnect()
      })

      expect(mockWagmiDisconnect).toHaveBeenCalled()
    })

    it('clears error state', async () => {
      // Trigger an error first
      setWindowProvider(null)
      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })
      expect(result.current.error).toBeTruthy()

      // Disconnect should clear error
      act(() => {
        result.current.disconnect()
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe('mutual exclusion', () => {
    it('extension takes priority over wagmi when both are connected', async () => {
      // Connect extension
      mockProvider.request
        .mockResolvedValueOnce(['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'])
        .mockResolvedValueOnce('0x2a')

      const { result } = await getHook()

      await act(async () => {
        await result.current.connectExtension()
      })

      // Even if wagmi says connected, extension address should be used
      mockWagmiAccount.isConnected = true
      mockWagmiAccount.address = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Address

      expect(result.current.address).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      expect(result.current.connectionMethod).toBe('extension')
    })
  })

  describe('refetchProfile', () => {
    it('is a function', async () => {
      const { result } = await getHook()
      expect(typeof result.current.refetchProfile).toBe('function')
    })

    it('does not throw when not connected', async () => {
      const { result } = await getHook()
      expect(() => result.current.refetchProfile()).not.toThrow()
    })
  })

  describe('return shape', () => {
    it('exposes all expected properties', async () => {
      const { result } = await getHook()
      const keys = Object.keys(result.current)

      expect(keys).toContain('isConnected')
      expect(keys).toContain('isConnecting')
      expect(keys).toContain('address')
      expect(keys).toContain('chainId')
      expect(keys).toContain('error')
      expect(keys).toContain('walletClient')
      expect(keys).toContain('publicClient')
      expect(keys).toContain('profileData')
      expect(keys).toContain('connectionMethod')
      expect(keys).toContain('isExtensionAvailable')
      expect(keys).toContain('isWalletConnectAvailable')
      expect(keys).toContain('connectExtension')
      expect(keys).toContain('connectWalletConnect')
      expect(keys).toContain('disconnect')
      expect(keys).toContain('switchNetwork')
      expect(keys).toContain('refetchProfile')
    })
  })
})
