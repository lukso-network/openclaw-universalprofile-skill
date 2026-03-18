import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
  type Hex,
  type Chain
} from 'viem'
import { useAccount, useDisconnect, useWalletClient as useWagmiWalletClient, useSwitchChain } from 'wagmi'
import { CHAINS, LSP0_ABI, DATA_KEYS, getChainById } from '../constants'
import { fetchLuksoProfileData } from './useLuksoProfile'
import { useLuksoConnector, useSetModalChain } from '../providers/WalletProvider'

// Note: knownUpAddress is intentionally NOT persisted in localStorage
// so users can search for a different profile on each visit

export interface WalletState {
  isConnected: boolean
  isConnecting: boolean
  address: Address | null
  chainId: number | null
  error: string | null
  walletClient: ReturnType<typeof useWagmiWalletClient>['data'] | null
  publicClient: PublicClient | null
}

export interface ProfileData {
  address: Address
  owner: Address
  controllersCount: number
  profileName?: string
  profileDescription?: string
  profileImage?: string
}

export type ConnectionMethod = 'extension' | 'walletconnect' | 'up-provider' | null

export function useWallet() {
  const luksoConnector = useLuksoConnector()
  const setModalChain = useSetModalChain()

  // === WAGMI HOOKS (driven by up-modal's wagmi config) ===
  const { address: wagmiAddress, isConnected: wagmiConnected, isConnecting: wagmiConnecting, chainId: wagmiChainId, connector: wagmiConnector } = useAccount()
  const { data: wagmiWalletClient } = useWagmiWalletClient()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()

  // === SHARED STATE ===
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  // === KNOWN UP ADDRESS (session-only, NOT persisted across reloads) ===
  // This lets users search for a different profile each time they visit
  const [knownUpAddress, setKnownUpAddressInternal] = useState<Address | null>(null)
  const [originalChainId, setOriginalChainId] = useState<number | null>(null)

  // Track explicit disconnects to prevent auto-reconnection
  const manuallyDisconnected = useRef(false)

  // === HANDLE WAGMI AUTO-RECONNECT ===
  useEffect(() => {
    if (wagmiConnected && manuallyDisconnected.current) {
      wagmiDisconnect()
    }
  }, [wagmiConnected, wagmiDisconnect])

  // === AUTO-CLOSE MODAL on successful connection ===
  // up-modal may not auto-close when connecting on non-LUKSO chains
  useEffect(() => {
    if (wagmiConnected && !manuallyDisconnected.current && luksoConnector) {
      luksoConnector.closeModal()
    }
  }, [wagmiConnected, luksoConnector])

  // === COMPUTED STATE ===
  const isConnected = wagmiConnected && !manuallyDisconnected.current
  const isConnecting = wagmiConnecting
  const address = isConnected ? (wagmiAddress ?? null) : null
  const chainId = isConnected ? (wagmiChainId ?? null) : null

  // Connection method derived from wagmi connector
  const connectionMethod = useMemo<ConnectionMethod>(() => {
    if (!isConnected || !wagmiConnector) return null
    if (wagmiConnector.id === 'up-provider') return 'up-provider'
    if (wagmiConnector.type === 'walletConnect') return 'walletconnect'
    return 'extension'
  }, [isConnected, wagmiConnector])

  // Public client
  const publicClient = useMemo(() => {
    const cid = chainId
    if (!cid) return null
    const knownChain = getChainById(cid)
    const chain: Chain = knownChain
      ? (knownChain as unknown as Chain)
      : ({ ...CHAINS.lukso, id: cid } as unknown as Chain)
    return createPublicClient({ chain, transport: http() })
  }, [chainId])

  // Wallet client from wagmi
  const walletClient = isConnected ? (wagmiWalletClient ?? null) : null

  // === STORE KNOWN UP ADDRESS on initial connection ===
  useEffect(() => {
    if (isConnected && address && !knownUpAddress) {
      setKnownUpAddressInternal(address)
      if (chainId) {
        setOriginalChainId(chainId)
      }
    }
  }, [isConnected, address, chainId, knownUpAddress])

  // === SET KNOWN UP ADDRESS (from external sources like ProfileSearch) ===
  const setKnownUpAddress = useCallback((addr: Address) => {
    setKnownUpAddressInternal(addr)
    setOriginalChainId(42)
  }, [])

  // === SWITCH NETWORK ===
  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!wagmiSwitchChain) return
    try {
      wagmiSwitchChain({ chainId: targetChainId })
    } catch (err) {
      console.error('Failed to switch network:', err)
      setError(err instanceof Error ? err.message : 'Failed to switch network')
    }
  }, [wagmiSwitchChain])

  // === PROFILE FETCHING ===
  const fetchProfileData = useCallback(async (addr: Address, pc: PublicClient) => {
    try {
      const owner = await pc.readContract({
        address: addr,
        abi: LSP0_ABI,
        functionName: 'owner',
      }) as Address

      const lengthData = await pc.readContract({
        address: addr,
        abi: LSP0_ABI,
        functionName: 'getData',
        args: [DATA_KEYS['AddressPermissions[]'] as Hex],
      }) as Hex

      const controllersCount = lengthData && lengthData !== '0x'
        ? parseInt(lengthData.slice(0, 34), 16)
        : 0

      const luksoProfile = await fetchLuksoProfileData(addr)

      setProfileData({
        address: addr,
        owner,
        controllersCount,
        profileName: luksoProfile.name || undefined,
        profileImage: luksoProfile.profileImageUrl || undefined,
      })
    } catch (err) {
      console.error('Error fetching profile data:', err)
    }
  }, [])

  // Fetch profile when connection changes
  const lastFetchKey = useRef<string | null>(null)
  useEffect(() => {
    const fetchKey = address && publicClient ? `${address}-${publicClient.chain?.id}` : null
    if (fetchKey && fetchKey !== lastFetchKey.current) {
      lastFetchKey.current = fetchKey
      fetchProfileData(address!, publicClient!)
    } else if (!fetchKey) {
      lastFetchKey.current = null
      setProfileData(null)
    }
  }, [address, publicClient, fetchProfileData])

  // === CONNECT (opens up-modal) ===
  const connect = useCallback(async (targetChainId?: number) => {
    if (!luksoConnector) {
      setError('Wallet modal not initialized yet. Please try again.')
      return
    }
    setError(null)
    manuallyDisconnected.current = false

    // Update the modal's target chain before opening so it doesn't force LUKSO
    if (targetChainId) {
      setModalChain(targetChainId)
    }

    luksoConnector.showSignInModal()
  }, [luksoConnector, setModalChain])

  // === DISCONNECT ===
  const disconnect = useCallback(() => {
    manuallyDisconnected.current = true

    wagmiDisconnect()
    luksoConnector?.closeModal()

    // Clear known UP address
    setKnownUpAddressInternal(null)
    setOriginalChainId(null)

    setProfileData(null)
    setError(null)
  }, [wagmiDisconnect, luksoConnector])

  // === PROFILE IMPORT: check if UP exists on current chain ===
  const checkUpExistsOnChain = useCallback(async (): Promise<boolean> => {
    if (!knownUpAddress || !publicClient) return false
    try {
      const code = await publicClient.getCode({ address: knownUpAddress })
      return !!code && code !== '0x'
    } catch (err) {
      console.error('[useWallet] getCode check failed:', err)
      return false
    }
  }, [knownUpAddress, publicClient])

  // Import the known UP as the active address for this chain
  const importProfile = useCallback(() => {
    if (!knownUpAddress) return
    if (publicClient) {
      fetchProfileData(knownUpAddress, publicClient)
    }
  }, [knownUpAddress, publicClient, fetchProfileData])

  // Whether the UI should show the ProfileImport section (connected case)
  // Shows when: connected, have a known UP, but the connected address doesn't match
  // (meaning the profile hasn't been imported on this chain yet)
  const needsProfileImport = !!(
    knownUpAddress &&
    isConnected &&
    address &&
    address.toLowerCase() !== knownUpAddress.toLowerCase()
  )

  // Get the raw provider from the wagmi connector (for up_import calls)
  const getProvider = useCallback(() => {
    if (!wagmiConnector) return null
    // Return a provider-like object that can call up_import
    return {
      request: async (args: { method: string; params?: unknown[] }) => {
        const provider = await wagmiConnector.getProvider()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (provider as any).request(args)
      },
      on: () => {},
      removeListener: () => {},
    }
  }, [wagmiConnector])

  return {
    isConnected,
    isConnecting,
    address,
    chainId,
    error,
    walletClient,
    publicClient,
    profileData,
    connectionMethod,
    isExtensionAvailable: true, // up-modal handles detection
    isWalletConnectAvailable: true, // up-modal handles WalletConnect
    isWalletClientReady: isConnected && walletClient !== null,
    knownUpAddress,
    setKnownUpAddress,
    originalChainId,
    needsProfileImport,
    pendingProfileImport: false, // up-modal handles all connection flows
    extensionChainDetected: null as number | null, // no longer needed
    getProvider,
    connect,
    // Legacy aliases for backward compatibility with App.tsx
    connectExtension: connect,
    connectWalletConnect: connect,
    disconnect,
    switchNetwork,
    checkUpExistsOnChain,
    importProfile,
    refetchProfile: () => {
      if (address && publicClient) {
        fetchProfileData(address, publicClient)
      }
    },
  }
}
