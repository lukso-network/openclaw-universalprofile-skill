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
  status: 'disconnected' as string,
  connector: undefined as { id: string; type: string; name: string; getProvider: () => Promise<unknown> } | undefined,
}
const mockWagmiWalletClient = { data: undefined }

const mockSwitchChain = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => mockWagmiAccount,
  useDisconnect: () => ({ disconnect: mockWagmiDisconnect }),
  useWalletClient: () => mockWagmiWalletClient,
  useSwitchChain: () => ({ switchChain: mockSwitchChain }),
}))

// --- LuksoConnector mock ---
const mockShowSignInModal = vi.fn()
const mockCloseModal = vi.fn()
const mockSetModalChain = vi.fn()
vi.mock('../providers/WalletProvider', () => ({
  useLuksoConnector: () => ({
    showSignInModal: mockShowSignInModal,
    closeModal: mockCloseModal,
  }),
  useSetModalChain: () => mockSetModalChain,
  markModalOpening: vi.fn(),
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

describe('useWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockWagmiAccount.isConnected = false
    mockWagmiAccount.isConnecting = false
    mockWagmiAccount.address = undefined
    mockWagmiAccount.chainId = undefined
    mockWagmiAccount.connector = undefined
    mockWagmiWalletClient.data = undefined
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
  })

  describe('connect', () => {
    it('opens the up-modal sign-in modal', async () => {
      const { result } = await getHook()

      await act(async () => {
        await result.current.connect()
      })

      expect(mockShowSignInModal).toHaveBeenCalled()
    })

    it('clears error on connect', async () => {
      const { result } = await getHook()

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('disconnect', () => {
    it('calls wagmi disconnect and closes modal', async () => {
      const { result } = await getHook()

      act(() => {
        result.current.disconnect()
      })

      expect(mockWagmiDisconnect).toHaveBeenCalled()
      expect(mockCloseModal).toHaveBeenCalled()
    })

    it('clears known UP address from localStorage', async () => {
      localStorage.setItem('openclaw_known_up_address', '0x1234')
      localStorage.setItem('openclaw_original_chain_id', '42')

      const { result } = await getHook()

      act(() => {
        result.current.disconnect()
      })

      expect(localStorage.getItem('openclaw_known_up_address')).toBeNull()
      expect(localStorage.getItem('openclaw_original_chain_id')).toBeNull()
    })

    it('clears error state', async () => {
      const { result } = await getHook()

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.profileData).toBeNull()
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
      expect(keys).toContain('connect')
      expect(keys).toContain('disconnect')
      expect(keys).toContain('switchNetwork')
      expect(keys).toContain('refetchProfile')
      expect(keys).toContain('getProvider')
    })
  })
})
