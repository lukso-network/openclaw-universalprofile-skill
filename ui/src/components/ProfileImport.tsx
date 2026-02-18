import { useState, useEffect, useCallback } from 'react'
import { LuksoProfileAvatar } from './LuksoProfileAvatar'
import { formatAddress } from '../utils'
import { getChainById } from '../constants'
import type { Address } from 'viem'

interface UPProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

interface ProfileImportProps {
  knownUpAddress: Address
  currentChainId: number
  originalChainId: number
  checkUpExistsOnChain: () => Promise<boolean>
  onImport: () => void
  /** Retry connecting the extension after a successful import */
  onRetryConnect?: () => Promise<void>
  /** Get the raw extension provider for up_import calls */
  getProvider?: () => UPProvider | null
  /** True when in the "not connected but chain detected" flow */
  isPendingImport?: boolean
}

export function ProfileImport({
  knownUpAddress,
  currentChainId,
  originalChainId,
  checkUpExistsOnChain,
  onImport,
  onRetryConnect,
  getProvider,
  isPendingImport,
}: ProfileImportProps) {
  const [checking, setChecking] = useState(true)
  const [existsOnChain, setExistsOnChain] = useState<boolean | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  const currentChain = getChainById(currentChainId)
  const originalChain = getChainById(originalChainId)
  const chainName = currentChain?.name ?? 'this network'
  const originalChainName = originalChain?.name ?? 'the original network'

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    setExistsOnChain(null)

    checkUpExistsOnChain().then((exists) => {
      if (!cancelled) {
        setExistsOnChain(exists)
        setChecking(false)
      }
    })

    return () => { cancelled = true }
  }, [checkUpExistsOnChain])

  const handleImport = useCallback(async () => {
    // If we're in the pending import flow (not connected), try up_import first
    if (isPendingImport && getProvider) {
      setImporting(true)
      setImportError(null)
      setShowManualInstructions(false)

      const provider = getProvider()
      if (provider) {
        try {
          // Try the UP extension's up_import method
          await provider.request({
            method: 'up_import',
            params: [knownUpAddress],
          })
          console.log('[ProfileImport] up_import succeeded')

          // Import succeeded — retry the full extension connection
          if (onRetryConnect) {
            await onRetryConnect()
          }
          setImporting(false)
          return
        } catch (err) {
          console.warn('[ProfileImport] up_import not supported or failed:', err)
          // Method not supported — show manual instructions
          setShowManualInstructions(true)
          setImporting(false)
          return
        }
      }

      setImporting(false)
    }

    // Fallback: standard import for the already-connected case
    onImport()
  }, [isPendingImport, getProvider, knownUpAddress, onRetryConnect, onImport])

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
            size="lg"
            showIdenticon={true}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Profile Found on {chainName}
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
                  Import your profile manually in the UP extension:
                </p>
                <ol className="text-sm text-blue-600 dark:text-blue-400 list-decimal list-inside space-y-1">
                  <li>Open the UP Browser Extension</li>
                  <li>Go to Settings or Profile Management</li>
                  <li>Select "Import Profile" or "Add Account"</li>
                  <li>Enter your address: <span className="font-mono text-xs">{formatAddress(knownUpAddress, 8)}</span></li>
                  <li>Complete the import process</li>
                </ol>
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
              <button
                onClick={handleImport}
                disabled={importing}
                className="btn-primary mt-3 inline-flex items-center gap-2"
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
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Profile Not Found on {chainName}
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
