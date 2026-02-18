import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type WalletClient,
  type PublicClient,
  type Address,
  type Hex,
  type Chain
} from 'viem'
import { useAccount, useDisconnect, useWalletClient as useWagmiWalletClient, useSwitchChain } from 'wagmi'
import { CHAINS, LSP0_ABI, DATA_KEYS, getChainById } from '../constants'
import { convertIpfsUrl, fetchProfileFromIndexer } from '../utils'
import { isWalletConnectConfigured } from '../lib/walletConfig'
import { getAppKitModal } from '../providers/WalletProvider'

// localStorage keys for persisting UP address across chain-change reloads
const LS_KNOWN_UP_ADDRESS = 'openclaw_known_up_address'
const LS_ORIGINAL_CHAIN_ID = 'openclaw_original_chain_id'

// Type for UP Provider
interface UPProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
}

export interface WalletState {
  isConnected: boolean
  isConnecting: boolean
  address: Address | null
  chainId: number | null
  error: string | null
  walletClient: WalletClient | null
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

export type ConnectionMethod = 'extension' | 'walletconnect' | null

export function useWallet() {
  // === WAGMI HOOKS (for WalletConnect) ===
  const wagmiAccount = useAccount()
  const { data: wagmiWalletClient, isLoading: wagmiWalletClientLoading } = useWagmiWalletClient()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChain: wagmiSwitchChain } = useSwitchChain()

  // === EXTENSION STATE ===
  const [extConnected, setExtConnected] = useState(false)
  const [extConnecting, setExtConnecting] = useState(false)
  const [extAddress, setExtAddress] = useState<Address | null>(null)
  const [extChainId, setExtChainId] = useState<number | null>(null)
  const [extWalletClient, setExtWalletClient] = useState<WalletClient | null>(null)

  // === SHARED STATE ===
  const [error, setError] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>(null)

  // === KNOWN UP ADDRESS (persists across chain switches) ===
  const [knownUpAddress, setKnownUpAddress] = useState<Address | null>(() => {
    const stored = localStorage.getItem(LS_KNOWN_UP_ADDRESS)
    return stored ? (stored as Address) : null
  })
  const [originalChainId, setOriginalChainId] = useState<number | null>(() => {
    const stored = localStorage.getItem(LS_ORIGINAL_CHAIN_ID)
    return stored ? parseInt(stored, 10) : null
  })

  // Prevent wagmi auto-reconnect — start disconnected, require explicit connect
  const manuallyDisconnected = useRef(true)

  // === PROVIDER DETECTION ===
  const getProvider = useCallback((): UPProvider | null => {
    if (typeof window === 'undefined') return null

    // Check for UP Browser Extension
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ethereum = (window as any).ethereum
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lukso = (window as any).lukso

    // Prefer lukso provider if available
    if (lukso) return lukso
    if (ethereum) return ethereum

    return null
  }, [])

  const isExtensionAvailable = useMemo(() => getProvider() !== null, [getProvider])

  // === HANDLE WAGMI AUTO-RECONNECT ===
  useEffect(() => {
    if (wagmiAccount.isConnected && manuallyDisconnected.current) {
      wagmiDisconnect()
    }
  }, [wagmiAccount.isConnected, wagmiDisconnect])

  // === COMPUTED STATE ===
  // Extension takes priority if both are connected
  const isWcConnected = wagmiAccount.isConnected && !manuallyDisconnected.current && !extConnected
  const isConnected = extConnected || isWcConnected
  const isConnecting = extConnecting || (wagmiAccount.isConnecting && !extConnected)

  const address = extConnected
    ? extAddress
    : isWcConnected
      ? (wagmiAccount.address ?? null)
      : null

  const chainId = extConnected
    ? extChainId
    : isWcConnected
      ? (wagmiAccount.chainId ?? null)
      : null

  // Public client — always create manually for consistency
  const publicClient = useMemo(() => {
    if (!chainId) return null
    const knownChain = getChainById(chainId)
    const chain: Chain = knownChain
      ? (knownChain as unknown as Chain)
      : ({ ...CHAINS.lukso, id: chainId } as unknown as Chain)
    return createPublicClient({ chain, transport: http() })
  }, [chainId])

  // Wallet client — extension uses manual, WC uses wagmi
  const walletClient = extConnected
    ? extWalletClient
    : isWcConnected
      ? (wagmiWalletClient ?? null)
      : null

  // === TRACK CONNECTION METHOD ===
  useEffect(() => {
    if (extConnected) setConnectionMethod('extension')
    else if (isWcConnected) setConnectionMethod('walletconnect')
    else setConnectionMethod(null)
  }, [extConnected, isWcConnected])

  // === STORE KNOWN UP ADDRESS on initial connection ===
  useEffect(() => {
    if (isConnected && address && !knownUpAddress) {
      setKnownUpAddress(address)
      localStorage.setItem(LS_KNOWN_UP_ADDRESS, address)
      if (chainId) {
        setOriginalChainId(chainId)
        localStorage.setItem(LS_ORIGINAL_CHAIN_ID, chainId.toString())
      }
    }
  }, [isConnected, address, chainId, knownUpAddress])

  // === DEBUG: WalletConnect client readiness ===
  useEffect(() => {
    if (isWcConnected && !wagmiWalletClient) {
      console.warn('[useWallet] WalletConnect connected but walletClient not yet available', {
        wagmiAccountStatus: wagmiAccount.status,
        wagmiChainId: wagmiAccount.chainId,
        wagmiAddress: wagmiAccount.address,
        wagmiWalletClientLoading,
      })
    }
  }, [isWcConnected, wagmiWalletClient, wagmiAccount.status, wagmiAccount.chainId, wagmiAccount.address, wagmiWalletClientLoading])

  // === SWITCH NETWORK ===
  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (extConnected) {
      // Extension path: use provider's wallet_switchEthereumChain
      const provider = getProvider()
      if (!provider) return
      const hexChainId = `0x${targetChainId.toString(16)}`
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hexChainId }],
        })
      } catch (err: unknown) {
        // 4902 = chain not added to wallet, try adding it
        if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 4902) {
          const chainConfig = getChainById(targetChainId)
          if (chainConfig) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: hexChainId,
                chainName: chainConfig.name,
                nativeCurrency: chainConfig.nativeCurrency,
                rpcUrls: chainConfig.rpcUrls.default.http,
                blockExplorerUrls: [chainConfig.blockExplorers.default.url],
              }],
            })
          }
        } else {
          console.error('Failed to switch network:', err)
          setError(err instanceof Error ? err.message : 'Failed to switch network')
        }
      }
    } else if (isWcConnected && wagmiSwitchChain) {
      // WalletConnect path: use wagmi's switchChain
      try {
        wagmiSwitchChain({ chainId: targetChainId })
      } catch (err) {
        console.error('Failed to switch network:', err)
        setError(err instanceof Error ? err.message : 'Failed to switch network')
      }
    }
  }, [extConnected, isWcConnected, getProvider, wagmiSwitchChain])

  // === PROFILE FETCHING ===
  const fetchProfileData = useCallback(async (addr: Address, pc: PublicClient) => {
    try {
      // Get owner
      const owner = await pc.readContract({
        address: addr,
        abi: LSP0_ABI,
        functionName: 'owner',
      }) as Address

      // Get controllers count
      const lengthData = await pc.readContract({
        address: addr,
        abi: LSP0_ABI,
        functionName: 'getData',
        args: [DATA_KEYS['AddressPermissions[]'] as Hex],
      }) as Hex

      const controllersCount = lengthData && lengthData !== '0x'
        ? parseInt(lengthData.slice(0, 34), 16)
        : 0

      let profileName: string | undefined
      let profileDescription: string | undefined
      let profileImage: string | undefined

      // Try LUKSO indexer first (only available for LUKSO chains)
      const pcChainId = pc.chain?.id
      if (pcChainId === 42 || pcChainId === 4201) {
        try {
          const indexerProfile = await fetchProfileFromIndexer(addr)
          if (indexerProfile) {
            profileName = indexerProfile.name || undefined
            profileImage = indexerProfile.profileImageUrl || undefined
          }
        } catch (err) {
          console.error('Indexer fetch failed, falling back to on-chain:', err)
        }
      }

      // Fallback: parse LSP3 on-chain data if indexer didn't return an image
      if (!profileImage) {
        const profileDataHex = await pc.readContract({
          address: addr,
          abi: LSP0_ABI,
          functionName: 'getData',
          args: [DATA_KEYS['LSP3Profile'] as Hex],
        }) as Hex

        if (profileDataHex && profileDataHex !== '0x' && profileDataHex.length > 10) {
          try {
            const urlHex = profileDataHex.slice(2 + 72)
            const urlBytes = urlHex.match(/.{1,2}/g)
            if (urlBytes) {
              let jsonUrl = ''
              for (const byte of urlBytes) {
                const charCode = parseInt(byte, 16)
                if (charCode === 0) break
                jsonUrl += String.fromCharCode(charCode)
              }

              if (jsonUrl) {
                const httpUrl = convertIpfsUrl(jsonUrl)
                const response = await fetch(httpUrl)
                if (response.ok) {
                  const profileJson = await response.json()
                  if (!profileName) {
                    profileName = profileJson.LSP3Profile?.name || profileJson.name
                  }
                  profileDescription = profileJson.LSP3Profile?.description || profileJson.description

                  const images = profileJson.LSP3Profile?.profileImage || profileJson.profileImage
                  if (images && images.length > 0) {
                    const imageUrl = typeof images[0] === 'string' ? images[0] : images[0]?.url
                    if (imageUrl) {
                      profileImage = convertIpfsUrl(imageUrl)
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error parsing LSP3 profile data:', err)
          }
        }
      }

      setProfileData({
        address: addr,
        owner,
        controllersCount,
        profileName,
        profileDescription,
        profileImage,
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

  // === CONNECT EXTENSION ===
  const connectExtension = useCallback(async () => {
    setExtConnecting(true)
    setError(null)

    // Disconnect wagmi to avoid conflicts
    if (wagmiAccount.isConnected) {
      wagmiDisconnect()
    }

    const provider = getProvider()
    if (!provider) {
      setExtConnecting(false)
      const msg = 'No UP Browser Extension detected. Please install the LUKSO UP Extension.'
      console.error('[useWallet]', msg)
      setError(msg)
      return
    }

    try {
      // Request accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned')
      }

      // Get chain ID
      const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string
      const cid = parseInt(chainIdHex, 16)

      // Determine chain config
      const knownChain = getChainById(cid)
      const chain: Chain = knownChain
        ? (knownChain as unknown as Chain)
        : ({ ...CHAINS.lukso, id: cid } as unknown as Chain)

      // Create wallet client
      const wc = createWalletClient({
        chain,
        transport: custom(provider),
      })

      setExtConnected(true)
      setExtConnecting(false)
      setExtAddress(accounts[0] as Address)
      setExtChainId(cid)
      setExtWalletClient(wc)
      manuallyDisconnected.current = false
    } catch (err) {
      console.error('Extension connection error:', err)
      setExtConnecting(false)
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
    }
  }, [getProvider, wagmiAccount.isConnected, wagmiDisconnect])

  // === CONNECT WALLETCONNECT ===
  const connectWalletConnect = useCallback(async () => {
    if (!isWalletConnectConfigured) {
      const msg = 'WalletConnect is not configured. Set VITE_WALLETCONNECT_PROJECT_ID in your environment.'
      console.error('[useWallet]', msg)
      setError(msg)
      return
    }

    const modal = getAppKitModal()
    if (!modal) {
      const msg = 'WalletConnect failed to initialize. Please try again.'
      console.error('[useWallet]', msg)
      setError(msg)
      return
    }

    setError(null)
    manuallyDisconnected.current = false

    // Disconnect extension if connected
    if (extConnected) {
      setExtConnected(false)
      setExtAddress(null)
      setExtChainId(null)
      setExtWalletClient(null)
    }

    try {
      await modal.open()
    } catch (err) {
      console.error('WalletConnect error:', err)
      setError(err instanceof Error ? err.message : 'Failed to open WalletConnect')
    }
  }, [extConnected])

  // === DISCONNECT ===
  const disconnect = useCallback(() => {
    manuallyDisconnected.current = true

    // Disconnect extension
    setExtConnected(false)
    setExtConnecting(false)
    setExtAddress(null)
    setExtChainId(null)
    setExtWalletClient(null)

    // Disconnect wagmi
    if (wagmiAccount.isConnected) {
      wagmiDisconnect()
    }

    // Clear known UP address
    setKnownUpAddress(null)
    setOriginalChainId(null)
    localStorage.removeItem(LS_KNOWN_UP_ADDRESS)
    localStorage.removeItem(LS_ORIGINAL_CHAIN_ID)

    setProfileData(null)
    setError(null)
    setConnectionMethod(null)
  }, [wagmiAccount.isConnected, wagmiDisconnect])

  // === EXTENSION EVENT LISTENERS ===
  useEffect(() => {
    if (!extConnected) return
    const provider = getProvider()
    if (!provider) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
        disconnect()
      } else if (extConnected) {
        setExtAddress(accs[0] as Address)
        if (publicClient) {
          fetchProfileData(accs[0] as Address, publicClient)
        }
      }
    }

    const handleChainChanged = () => {
      // Persist known UP address before reload so it survives the chain switch
      if (knownUpAddress) {
        localStorage.setItem(LS_KNOWN_UP_ADDRESS, knownUpAddress)
      }
      if (originalChainId) {
        localStorage.setItem(LS_ORIGINAL_CHAIN_ID, originalChainId.toString())
      }
      window.location.reload()
    }

    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged)
      provider.removeListener('chainChanged', handleChainChanged)
    }
  }, [extConnected, getProvider, disconnect, publicClient, fetchProfileData, knownUpAddress, originalChainId])

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
    if (extConnected) {
      setExtAddress(knownUpAddress)
    }
    // Trigger profile re-fetch for the imported address
    if (publicClient) {
      fetchProfileData(knownUpAddress, publicClient)
    }
  }, [knownUpAddress, extConnected, publicClient, fetchProfileData])

  // Whether the UI should show the ProfileImport section
  const needsProfileImport = !!(
    knownUpAddress &&
    isConnected &&
    originalChainId &&
    chainId &&
    chainId !== originalChainId &&
    address?.toLowerCase() !== knownUpAddress.toLowerCase()
  )

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
    isExtensionAvailable,
    isWalletConnectAvailable: isWalletConnectConfigured,
    isWalletClientReady: isConnected && walletClient !== null,
    knownUpAddress,
    originalChainId,
    needsProfileImport,
    connectExtension,
    connectWalletConnect,
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
