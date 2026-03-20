import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPublicClient, http, type Chain } from 'viem'
import { LuksoProfileAvatar } from './LuksoProfileAvatar'
import { useLuksoProfile } from '../hooks/useLuksoProfile'
import { formatAddress } from '../utils'
import { CHAINS, getChainById } from '../constants'
import type { Address } from 'viem'

interface UPProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

interface ProfileImportProps {
  knownUpAddress: Address
  currentChainId: number
  originalChainId: number
  checkUpExistsOnChain?: () => Promise<boolean>
  onImport: () => void
  /** Retry connecting the extension after a successful import */
  onRetryConnect?: () => Promise<void>
  /** Get the raw extension provider for up_import calls */
  getProvider?: () => UPProvider | null
  /** True when in the "not connected but chain detected" flow */
  isPendingImport?: boolean
  /** Whether the wallet is connected — needed for import to work */
  isConnected?: boolean
  /** Called when user needs to connect first */
  onConnect?: () => void
}

export function ProfileImport({
  knownUpAddress,
  currentChainId,
  originalChainId,
  // checkUpExistsOnChain is kept in the interface for backward compat but no longer used
  // — we now create a local public client to check directly
  onImport: _onImport,
  onRetryConnect,
  getProvider,
  isPendingImport,
  isConnected = false,
  onConnect: _onConnect,
}: ProfileImportProps) {
  const [checking, setChecking] = useState(true)
  const [existsOnChain, setExistsOnChain] = useState<boolean | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  // Always fetch profile metadata from LUKSO mainnet
  const luksoProfile = useLuksoProfile(knownUpAddress)

  const currentChain = getChainById(currentChainId)
  const originalChain = getChainById(originalChainId)
  const chainName = currentChain?.name ?? 'this network'
  const originalChainName = originalChain?.name ?? 'the original network'

  // Create a public client for the current chain — this works even when not connected
  const localPublicClient = useMemo(() => {
    const knownChain = getChainById(currentChainId)
    const chain: Chain = knownChain
      ? (knownChain as unknown as Chain)
      : ({ ...CHAINS.lukso, id: currentChainId } as unknown as Chain)
    return createPublicClient({ chain, transport: http() })
  }, [currentChainId])

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    setExistsOnChain(null)

    // Use local public client to check directly — works without wallet connection
    localPublicClient.getCode({ address: knownUpAddress }).then((code) => {
      if (!cancelled) {
        setExistsOnChain(!!code && code !== '0x')
        setChecking(false)
      }
    }).catch((err) => {
      console.error('[ProfileImport] getCode check failed:', err)
      if (!cancelled) {
        setExistsOnChain(false)
        setChecking(false)
      }
    })

    return () => { cancelled = true }
  }, [localPublicClient, knownUpAddress])

  const handleImport = useCallback(async () => {
    console.log('[ProfileImport] handleImport called, knownUpAddress:', knownUpAddress)
    
    setImporting(true)
    setImportError(null)
    setShowManualInstructions(false)

    // Get the UP extension provider — try multiple sources:
    // 1. window.lukso (UP Extension direct)
    // 2. wagmi connector provider (if connected)
    // 3. EIP-6963 announced providers
    let provider: any = null

    // Try window.lukso first — works without wagmi connection
    if (typeof window !== 'undefined' && (window as any).lukso) {
      provider = (window as any).lukso
      console.log('[ProfileImport] Using window.lukso provider')
    }
    
    // Fallback: try wagmi connector provider
    if (!provider && getProvider) {
      const wagmiProvider = getProvider()
      if (wagmiProvider) {
        provider = wagmiProvider
        console.log('[ProfileImport] Using wagmi connector provider')
      }
    }

    if (!provider) {
      console.error('[ProfileImport] No UP extension provider found')
      setImportError('UP Browser Extension not detected. Please install it first.')
      setImporting(false)
      return
    }

    try {
      // Check the extension's current chain and switch if needed
      const currentChainHex = await provider.request({ method: 'eth_chainId' }) as string
      const currentChain = parseInt(currentChainHex, 16)
      console.log('[ProfileImport] Extension on chain:', currentChain, 'target:', currentChainId)

      if (currentChain !== currentChainId) {
        console.log('[ProfileImport] Switching extension to chain:', currentChainId)
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${currentChainId.toString(16)}` }],
        })
        console.log('[ProfileImport] Chain switch succeeded')
      }

      console.log('[ProfileImport] Calling up_import with:', knownUpAddress)
      await provider.request({
        method: 'up_import',
        params: [knownUpAddress],
      })
      console.log('[ProfileImport] up_import succeeded')

      // Import succeeded — show instructions to confirm in extension, then reconnect
      setShowManualInstructions(true)
      setImporting(false)
    } catch (err: any) {
      console.warn('[ProfileImport] up_import failed:', err)
      const message = err?.message || String(err)
      
      if (message.includes('not supported') || message.includes('not found') || message.includes('Method')) {
        setShowManualInstructions(true)
      } else {
        setImportError(`Import failed: ${message}`)
      }
      setImporting(false)
    }
  }, [knownUpAddress, getProvider])

  const handleRetryAfterManualImport = useCallback(async () => {
    if (onRetryConnect) {
      setImporting(true)
      setImportError(null)
      setShowManualInstructions(false)
      try {
        await onRetryConnect()
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Connection failed. Please try again.')
      }
      setImporting(false)
    }
  }, [onRetryConnect])

  // Loading state
  if (checking) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-lukso-pink" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-gray-600 dark:text-gray-400">
            Checking if your Universal Profile exists on {chainName}...
          </span>
        </div>
      </div>
    )
  }

  // UP exists on this chain — offer import
  if (existsOnChain) {
    return (
      <div className="card border-2 border-lukso-pink/30">
        <div className="flex items-start gap-4">
          <LuksoProfileAvatar
            address={knownUpAddress}
            profileUrl={luksoProfile.profileImageUrl}
            name={luksoProfile.name}
            size="lg"
            showIdenticon={true}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {luksoProfile.name || 'Profile Found'}
              {currentChainId !== 42 && currentChainId !== 4201 && (
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                  (on {chainName})
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isPendingImport
                ? `Your Universal Profile from ${originalChainName} is deployed on ${chainName}, but it needs to be imported into the UP extension before you can connect.`
                : `Your Universal Profile from ${originalChainName} is deployed on ${chainName}.`
              }
            </p>
            <p className="address mt-1">{formatAddress(knownUpAddress, 6)}</p>

            {importError && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
              </div>
            )}

            {showManualInstructions && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Confirm the import profile in the Universal Profile Extension.
                </p>
                <button
                  onClick={handleRetryAfterManualImport}
                  disabled={importing}
                  className="btn-primary mt-2 inline-flex items-center gap-2 text-sm"
                >
                  {importing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry Connection
                    </>
                  )}
                </button>
              </div>
            )}

            {!showManualInstructions && (
              <div className="mt-3">
                <button
                  onClick={() => {
                    console.log('[ProfileImport] Button clicked — calling handleImport directly')
                    handleImport()
                  }}
                  disabled={importing}
                  className={`inline-flex items-center gap-2 ${isConnected ? 'btn-primary' : 'btn-primary'}`}
                >
                  {importing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Import Profile
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // UP does NOT exist on this chain
  return (
    <div className="card border-2 border-amber-300/30 dark:border-amber-500/20">
      <div className="flex items-start gap-3">
        <LuksoProfileAvatar
          address={knownUpAddress}
          profileUrl={luksoProfile.profileImageUrl}
          name={luksoProfile.name}
          size="md"
          showIdenticon={true}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {luksoProfile.name ? (
              <>
                {luksoProfile.name}
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                  — not found on {chainName}
                </span>
              </>
            ) : (
              `Profile Not Found on ${chainName}`
            )}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Your Universal Profile has not been deployed on {chainName} yet.
          </p>
          <p className="address mt-1">{formatAddress(knownUpAddress, 6)}</p>
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              To deploy your profile on {chainName}, ask your AI agent — it can handle the cross-chain deployment for you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
