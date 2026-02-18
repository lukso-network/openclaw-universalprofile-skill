import { formatAddress } from '../utils'
import { LuksoProfileAvatar } from './LuksoProfileAvatar'
import { getChainById } from '../constants'
import type { ProfileData, ConnectionMethod } from '../hooks/useWallet'

interface ConnectionSectionProps {
  isConnected: boolean
  isConnecting: boolean
  address: string | null
  profileData: ProfileData | null
  isExtensionAvailable: boolean
  isWalletConnectAvailable: boolean
  connectionMethod: ConnectionMethod
  error: string | null
  chainId?: number | null
  onConnectExtension: () => void
  onConnectWalletConnect: () => void
  onDisconnect: () => void
}

export function ConnectionSection({
  isConnected,
  isConnecting,
  address,
  profileData,
  isExtensionAvailable,
  isWalletConnectAvailable,
  connectionMethod,
  error,
  chainId,
  onConnectExtension,
  onConnectWalletConnect,
  onDisconnect,
}: ConnectionSectionProps) {
  // Connected state — show profile info
  if (isConnected && address) {
    return (
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Profile Avatar */}
            <LuksoProfileAvatar
              address={address}
              profileUrl={profileData?.profileImage}
              name={profileData?.profileName}
              size="xl"
              showIdenticon={true}
            />

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">
                  {profileData?.profileName || 'Universal Profile'}
                  {chainId && chainId !== 42 && chainId !== 4201 && (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                      (on {getChainById(chainId)?.name ?? 'Unknown'})
                    </span>
                  )}
                </h3>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                  Connected
                </span>
                {connectionMethod && (
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium rounded-full">
                    {connectionMethod === 'extension' ? 'Extension' : 'WalletConnect'}
                  </span>
                )}
              </div>
              <p className="address mt-1">{formatAddress(address, 6)}</p>
              {profileData && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {profileData.controllersCount} controller{profileData.controllersCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onDisconnect}
            className="btn-secondary text-sm"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  // Not connected — show connection options
  const hasAnyOption = isExtensionAvailable || isWalletConnectAvailable

  if (!hasAnyOption) {
    return (
      <div className="card">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">No Wallet Detected</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Please install the LUKSO UP Browser Extension to connect your Universal Profile.
          </p>
          <a
            href="https://docs.lukso.tech/install-up-browser-extension"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Install Extension
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-lukso-pink/20 to-lukso-purple/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-lukso-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Connect Your Universal Profile</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Connect to authorize OpenClaw as a controller on your Universal Profile.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          {/* UP Browser Extension */}
          {isExtensionAvailable && (
            <button
              onClick={onConnectExtension}
              disabled={isConnecting}
              className="btn-primary inline-flex items-center justify-center gap-2 w-full"
            >
              {isConnecting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  UP Browser Extension
                </>
              )}
            </button>
          )}

          {/* WalletConnect */}
          {isWalletConnectAvailable && (
            <button
              onClick={onConnectWalletConnect}
              disabled={isConnecting}
              className="btn-secondary inline-flex items-center justify-center gap-2 w-full"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
              </svg>
              WalletConnect
            </button>
          )}

          {/* Install extension link when not available */}
          {!isExtensionAvailable && (
            <a
              href="https://docs.lukso.tech/install-up-browser-extension"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-lukso-pink dark:hover:text-lukso-pink transition-colors"
            >
              Don't have the UP Extension? Install it here
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
