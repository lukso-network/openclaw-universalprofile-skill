import { useState, useCallback, useEffect } from 'react'
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
import { CHAINS, LSP0_ABI, DATA_KEYS } from '../constants'
import { convertIpfsUrl, fetchProfileFromIndexer } from '../utils'

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

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isConnecting: false,
    address: null,
    chainId: null,
    error: null,
    walletClient: null,
    publicClient: null,
  })
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  // Get the LUKSO UP Provider
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

  // Check if UP extension is available
  const isExtensionAvailable = useCallback((): boolean => {
    return getProvider() !== null
  }, [getProvider])

  // Connect wallet
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }))
    
    const provider = getProvider()
    if (!provider) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'No UP Browser Extension detected. Please install the LUKSO UP Extension.',
      }))
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
      const chainId = parseInt(chainIdHex, 16)

      // Determine chain config
      let chain: Chain
      if (chainId === 42) {
        chain = CHAINS.lukso as unknown as Chain
      } else if (chainId === 4201) {
        chain = CHAINS.luksoTestnet as unknown as Chain
      } else {
        // Use LUKSO mainnet as default config but with correct chain ID
        chain = {
          ...CHAINS.lukso,
          id: chainId,
        } as unknown as Chain
      }

      // Create clients
      const walletClient = createWalletClient({
        chain,
        transport: custom(provider),
      })

      const publicClient = createPublicClient({
        chain,
        transport: http(),
      })

      setState({
        isConnected: true,
        isConnecting: false,
        address: accounts[0] as Address,
        chainId,
        error: null,
        walletClient,
        publicClient,
      })

      // Fetch profile data
      await fetchProfileData(accounts[0] as Address, publicClient)
    } catch (err) {
      console.error('Connection error:', err)
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Failed to connect wallet',
      }))
    }
  }, [getProvider])

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      chainId: null,
      error: null,
      walletClient: null,
      publicClient: null,
    })
    setProfileData(null)
  }, [])

  // Fetch profile data from UP
  const fetchProfileData = useCallback(async (address: Address, publicClient: PublicClient) => {
    try {
      // Get owner
      const owner = await publicClient.readContract({
        address,
        abi: LSP0_ABI,
        functionName: 'owner',
      }) as Address

      // Get controllers count
      const lengthData = await publicClient.readContract({
        address,
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

      // Try indexer first (returns pre-resolved HTTP image URLs)
      try {
        const indexerProfile = await fetchProfileFromIndexer(address)
        if (indexerProfile) {
          profileName = indexerProfile.name || undefined
          profileImage = indexerProfile.profileImageUrl || undefined
        }
      } catch (err) {
        console.error('Indexer fetch failed, falling back to on-chain:', err)
      }

      // Fallback: parse LSP3 on-chain data if indexer didn't return an image
      if (!profileImage) {
        const profileDataHex = await publicClient.readContract({
          address,
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
        address,
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

  // Listen for account/chain changes
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    const handleAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
        disconnect()
      } else if (state.isConnected) {
        setState(prev => ({ ...prev, address: accs[0] as Address }))
        if (state.publicClient) {
          fetchProfileData(accs[0] as Address, state.publicClient)
        }
      }
    }

    const handleChainChanged = (_chainId: unknown) => {
      // Reload the page on chain change for simplicity
      window.location.reload()
    }

    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged)
      provider.removeListener('chainChanged', handleChainChanged)
    }
  }, [getProvider, disconnect, state.isConnected, state.publicClient, fetchProfileData])

  return {
    ...state,
    profileData,
    isExtensionAvailable: isExtensionAvailable(),
    connect,
    disconnect,
    refetchProfile: () => {
      if (state.address && state.publicClient) {
        fetchProfileData(state.address, state.publicClient)
      }
    },
  }
}
