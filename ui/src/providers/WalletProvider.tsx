import { type ReactNode, useEffect, useState, useRef, createContext, useContext } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type Config } from 'wagmi'
import { watchAccount } from '@wagmi/core'
import { setupLuksoConnector, wagmi as wagmiService } from '@lukso/up-modal'
import type { LuksoConnector } from '@lukso/up-modal'
// Note: we use up-modal's built-in wagmi config with chains.additional
// instead of createMultiChainWagmiConfig, so walletConnect is included

const queryClient = new QueryClient()

/** Force-close the up-modal connect dialog via its `open` property */
function forceCloseModal() {
  const modal = document.querySelector('connect-modal') as any
  if (modal) {
    modal.open = false
  }
}

function isInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

// Context to share the LuksoConnector with hooks
const LuksoConnectorContext = createContext<LuksoConnector | null>(null)

// Context for updating the modal's target chain
const SetModalChainContext = createContext<((chainId: number) => void) | null>(null)

export function useLuksoConnector(): LuksoConnector | null {
  return useContext(LuksoConnectorContext)
}

export function useSetModalChain(): (chainId: number) => void {
  const fn = useContext(SetModalChainContext)
  return fn || (() => {})
}

/** Mark that we're actively opening the modal — so watchAccount can close it on connect */
export function markModalOpening() {
  isModalOpeningRef.current = true
}

// Track whether we're actively opening the modal (to avoid closing it on stale watchAccount events)
const isModalOpeningRef = { current: false }

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connector, setConnector] = useState<LuksoConnector | null>(null)
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null)
  const wagmiConfigRef = useRef<Config | null>(null)

  useEffect(() => {
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

    setupLuksoConnector({
      theme: 'light',
      chains: {
        additional: [
          { id: 1, name: 'Ethereum', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://ethereum-rpc.publicnode.com'] } } },
          { id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } } },
        ],
      } as any,
      ...(projectId ? { walletConnect: { projectId } } : {}),
      ...(isInIframe() ? { embeddedWallet: { enabled: true } } : {}),
      connectors: {
        eoa: false,
      },
      onConnect: (...args: any[]) => {
        console.log('[WalletProvider] onConnect fired!', args)
        isModalOpeningRef.current = false
        forceCloseModal()
      },
    }).then((c) => {
      setConnector(c)
      wagmiConfigRef.current = c.wagmiConfig
      setWagmiConfig(c.wagmiConfig as unknown as Config)

      // Debug: log wagmi config chains
      const cfg = c.wagmiConfig as any
      console.log('[WalletProvider] wagmi config chains:', cfg.chains?.map((ch: any) => ({ id: ch.id, name: ch.name })))
      console.log('[WalletProvider] wagmi connectors:', cfg.connectors?.map((cn: any) => ({ id: cn.id, name: cn.name, type: cn.type })))

      // Watch for account changes via wagmi — close the modal when connected
      // Only close if we're actively opening the modal (isModalOpeningRef)
      watchAccount(c.wagmiConfig as any, {
        onChange(account) {
          console.log('[WalletProvider] watchAccount:', account.status, account.address, account.chainId, 'modalOpening:', isModalOpeningRef.current)
          if (account.isConnected && isModalOpeningRef.current) {
            console.log('[WalletProvider] Connection detected during modal flow, closing modal')
            isModalOpeningRef.current = false
            forceCloseModal()
          }
        },
      })
    })
  }, [])

  // Callback to update the modal's target chain before opening
  const setModalChain = useRef((chainId: number) => {
    console.log('[WalletProvider] setModalChain called:', chainId, 'wagmiConfig:', !!wagmiConfigRef.current)
    if (wagmiConfigRef.current) {
      wagmiService.configure({
        wagmiConfig: wagmiConfigRef.current,
        chainId,
        connectors: { eoa: false },
      })
    }
  })

  if (!connector || !wagmiConfig) {
    return null
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <LuksoConnectorContext.Provider value={connector}>
          <SetModalChainContext.Provider value={setModalChain.current}>
            {children}
          </SetModalChainContext.Provider>
        </LuksoConnectorContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
