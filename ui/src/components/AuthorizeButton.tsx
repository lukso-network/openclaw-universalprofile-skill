import { useState } from 'react'
import { validatePermissions } from '../utils'
import type { AuthorizationStatus } from '../hooks/useAuthorization'

interface AuthorizeButtonProps {
  status: AuthorizationStatus
  permissions: bigint
  isReady: boolean
  onAuthorize: () => void
}

export function AuthorizeButton({
  status,
  permissions,
  isReady,
  onAuthorize,
}: AuthorizeButtonProps) {
  const [confirmed, setConfirmed] = useState(false)
  const validation = validatePermissions(permissions)
  const hasCriticalRisks = validation.risks.length > 0

  const handleClick = () => {
    if (hasCriticalRisks && !confirmed) {
      // Require confirmation for critical permissions
      return
    }
    onAuthorize()
  }

  const isDisabled = !isReady || 
    status === 'preparing' || 
    status === 'pending' || 
    (hasCriticalRisks && !confirmed)

  const getButtonContent = () => {
    switch (status) {
      case 'preparing':
        return (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Preparing Transaction...</span>
          </>
        )
      case 'pending':
        return (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Confirming on Blockchain...</span>
          </>
        )
      default:
        return (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Authorize Controller</span>
          </>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Critical confirmation checkbox */}
      {hasCriticalRisks && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-300 dark:border-red-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
            />
            <div>
              <span className="font-semibold text-red-700 dark:text-red-400">
                I understand the risks
              </span>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                I acknowledge that granting these critical permissions could result in 
                complete loss of control over my Universal Profile and all associated assets. 
                I have verified the controller address and fully trust this controller.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
          hasCriticalRisks
            ? confirmed
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-red-200 dark:bg-red-900/50 text-red-400 cursor-not-allowed'
            : 'btn-primary'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {getButtonContent()}
      </button>

      {/* Help text */}
      {!isReady && (
        <p className="text-sm text-center text-gray-500 dark:text-gray-400">
          Connect your wallet and enter a controller address to continue
        </p>
      )}

      {status === 'pending' && (
        <p className="text-sm text-center text-gray-500 dark:text-gray-400">
          Please confirm the transaction in your wallet...
        </p>
      )}
    </div>
  )
}
