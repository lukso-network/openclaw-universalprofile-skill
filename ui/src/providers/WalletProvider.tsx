import { type ReactNode, useEffect, useState, useRef, createContext, useContext } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type Config } from 'wagmi'
import { watchAccount } from '@wagmi/core'
import { setupLuksoConnector, wagmi as wagmiService } from '@lukso/up-modal'
import type { LuksoConnector } from '@lukso/up-modal'
import { createMultiChainWagmiConfig } from '../lib/walletConfig'

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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connector, setConnector] = useState<LuksoConnector | null>(null)
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null)
  const wagmiConfigRef = useRef<Config | null>(null)

  useEffect(() => {
    const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

    // Create our own wagmi config with all supported chains (LUKSO, Ethereum, Base)
    // up-modal's built-in config only supports LUKSO chains
    const customWagmiConfig = createMultiChainWagmiConfig()
    wagmiConfigRef.current = customWagmiConfig

    setupLuksoConnector({
      theme: 'light',
      wagmiConfig: customWagmiConfig,
      ...(projectId ? { walletConnect: { projectId } } : {}),
      ...(isInIframe() ? { embeddedWallet: { enabled: true } } : {}),
      connectors: {
        eoa: false,
      },
      onConnect: () => {
        forceCloseModal()
      },
    }).then((c) => {
      setConnector(c)
      setWagmiConfig(customWagmiConfig as unknown as Config)

      // Watch for account changes via wagmi — close the modal when connected
      // This is a fallback for when up-modal's own onConnect doesn't fire (non-LUKSO chains)
      watchAccount(customWagmiConfig as any, {
        onChange(account) {
          console.log('[WalletProvider] watchAccount:', account.status, account.address, account.chainId)
          if (account.isConnected) {
            console.log('[WalletProvider] Connection detected, closing modal')
            forceCloseModal()
          }
        },
      })
    })
  }, [])

  // Callback to update the modal's target chain before opening
  const setModalChain = useRef((chainId: number) => {
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
