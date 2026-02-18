import { useState } from 'react'
import { getChainById } from '../constants'
import { formatAddress } from '../utils'
import type { Hex, Address } from 'viem'

interface SuccessConfirmationProps {
  txHash: Hex
  controllerAddress: Address
  upAddress: Address
  chainId: number
  onClose: () => void
}

export function SuccessConfirmation({
  txHash,
  controllerAddress,
  upAddress,
  chainId,
  onClose,
}: SuccessConfirmationProps) {
  const [copied, setCopied] = useState<string | null>(null)

  const getExplorerUrl = () => {
    const chain = getChainById(chainId)
    if (chain) {
      return `${chain.blockExplorers.default.url}/tx/${txHash}`
    }
    return `https://explorer.execution.mainnet.lukso.network/tx/${txHash}`
  }

  const getProfileUrl = () => {
    if (chainId === 42) {
      return `https://universalprofile.cloud/${upAddress}`
    } else if (chainId === 4201) {
      return `https://universalprofile.cloud/testnet/${upAddress}`
    }
    // For Base/Ethereum, link to the explorer address page
    const chain = getChainById(chainId)
    if (chain) {
      return `${chain.blockExplorers.default.url}/address/${upAddress}`
    }
    return `https://universalprofile.cloud/${upAddress}`
  }

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Success header */}
        <div className="animate-gradient-bg p-6 text-center">
          <div className="w-16 h-16 mx-auto bg-white rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Authorization Successful! 🎉
          </h2>
          <p className="text-white/80">
            OpenClaw is now authorized as a controller
          </p>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {/* Controller address */}
          <div>
            <label className="label">Controller Address</label>
            <div className="flex items-center gap-2">
              <code className="address flex-1 text-xs">
                {formatAddress(controllerAddress, 8)}
              </code>
              <button
                onClick={() => handleCopy(controllerAddress, 'controller')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                {copied === 'controller' ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Transaction hash */}
          <div>
            <label className="label">Transaction Hash</label>
            <div className="flex items-center gap-2">
              <code className="address flex-1 text-xs">
                {formatAddress(txHash, 8)}
              </code>
              <button
                onClick={() => handleCopy(txHash, 'tx')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                {copied === 'tx' ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2 pt-2">
            <a
              href={getExplorerUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on Explorer
            </a>
            <a
              href={getProfileUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              View Profile
            </a>
          </div>

          {/* What's next */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">What's Next?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              OpenClaw can now interact with your Universal Profile using the granted permissions. 
              You can manage or revoke this controller's permissions anytime from your profile settings.
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="btn-primary w-full"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
