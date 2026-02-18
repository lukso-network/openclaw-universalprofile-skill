import { useState, useEffect, useCallback } from 'react'
import { LuksoProfileAvatar } from './LuksoProfileAvatar'
import { formatAddress } from '../utils'
import { getChainById } from '../constants'
import type { Address } from 'viem'

interface ProfileImportProps {
  knownUpAddress: Address
  currentChainId: number
  originalChainId: number
  checkUpExistsOnChain: () => Promise<boolean>
  onImport: () => void
}

export function ProfileImport({
  knownUpAddress,
  currentChainId,
  originalChainId,
  checkUpExistsOnChain,
  onImport,
}: ProfileImportProps) {
  const [checking, setChecking] = useState(true)
  const [existsOnChain, setExistsOnChain] = useState<boolean | null>(null)

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

  const handleImport = useCallback(() => {
    onImport()
  }, [onImport])

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
              Your Universal Profile from {originalChainName} is deployed on {chainName}.
            </p>
            <p className="address mt-1">{formatAddress(knownUpAddress, 6)}</p>
            <button
              onClick={handleImport}
              className="btn-primary mt-3 inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Profile
            </button>
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
