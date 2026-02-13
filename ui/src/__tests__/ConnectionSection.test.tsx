import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectionSection } from '../components/ConnectionSection'
import type { ProfileData, ConnectionMethod } from '../hooks/useWallet'

const defaultProps = {
  isConnected: false,
  isConnecting: false,
  address: null as string | null,
  profileData: null as ProfileData | null,
  isExtensionAvailable: true,
  isWalletConnectAvailable: true,
  connectionMethod: null as ConnectionMethod,
  error: null as string | null,
  onConnectExtension: vi.fn(),
  onConnectWalletConnect: vi.fn(),
  onDisconnect: vi.fn(),
}

function renderSection(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<ConnectionSection {...props} />)
}

describe('ConnectionSection', () => {
  describe('disconnected state', () => {
    it('shows connect heading when disconnected', () => {
      renderSection()
      expect(screen.getByText('Connect Your Universal Profile')).toBeInTheDocument()
    })

    it('shows extension button when extension is available', () => {
      renderSection({ isExtensionAvailable: true })
      expect(screen.getByText('UP Browser Extension')).toBeInTheDocument()
    })

    it('shows WalletConnect button when WalletConnect is available', () => {
      renderSection({ isWalletConnectAvailable: true })
      expect(screen.getByText('WalletConnect')).toBeInTheDocument()
    })

    it('shows both connection options when both are available', () => {
      renderSection({ isExtensionAvailable: true, isWalletConnectAvailable: true })
      expect(screen.getByText('UP Browser Extension')).toBeInTheDocument()
      expect(screen.getByText('WalletConnect')).toBeInTheDocument()
    })

    it('shows only WalletConnect when extension is not available', () => {
      renderSection({ isExtensionAvailable: false, isWalletConnectAvailable: true })
      expect(screen.queryByText('UP Browser Extension')).not.toBeInTheDocument()
      expect(screen.getByText('WalletConnect')).toBeInTheDocument()
    })

    it('shows install extension link when extension is not available', () => {
      renderSection({ isExtensionAvailable: false, isWalletConnectAvailable: true })
      const link = screen.getByText(/Don't have the UP Extension/)
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', 'https://docs.lukso.tech/install-up-browser-extension')
    })

    it('does not show install link when extension is available', () => {
      renderSection({ isExtensionAvailable: true, isWalletConnectAvailable: true })
      expect(screen.queryByText(/Don't have the UP Extension/)).not.toBeInTheDocument()
    })
  })

  describe('no wallet detected', () => {
    it('shows no wallet message when neither option is available', () => {
      renderSection({ isExtensionAvailable: false, isWalletConnectAvailable: false })
      expect(screen.getByText('No Wallet Detected')).toBeInTheDocument()
    })

    it('shows install extension link in no wallet state', () => {
      renderSection({ isExtensionAvailable: false, isWalletConnectAvailable: false })
      const link = screen.getByText('Install Extension')
      expect(link.closest('a')).toHaveAttribute('href', 'https://docs.lukso.tech/install-up-browser-extension')
    })

    it('does not show connect buttons in no wallet state', () => {
      renderSection({ isExtensionAvailable: false, isWalletConnectAvailable: false })
      expect(screen.queryByText('UP Browser Extension')).not.toBeInTheDocument()
      expect(screen.queryByText('WalletConnect')).not.toBeInTheDocument()
    })
  })

  describe('connected state', () => {
    const connectedProps = {
      isConnected: true,
      address: '0x1234567890abcdef1234567890abcdef12345678',
      connectionMethod: 'extension' as ConnectionMethod,
    }

    it('shows Connected badge', () => {
      renderSection(connectedProps)
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('shows disconnect button', () => {
      renderSection(connectedProps)
      expect(screen.getByText('Disconnect')).toBeInTheDocument()
    })

    it('shows connection method label for extension', () => {
      renderSection({ ...connectedProps, connectionMethod: 'extension' })
      expect(screen.getByText('Extension')).toBeInTheDocument()
    })

    it('shows connection method label for WalletConnect', () => {
      renderSection({ ...connectedProps, connectionMethod: 'walletconnect' })
      expect(screen.getByText('WalletConnect')).toBeInTheDocument()
    })

    it('shows truncated address', () => {
      renderSection(connectedProps)
      // formatAddress(address, 6) → "0x123456...345678"
      expect(screen.getByText('0x123456...345678')).toBeInTheDocument()
    })

    it('shows profile name when available', () => {
      renderSection({
        ...connectedProps,
        profileData: {
          address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
          controllersCount: 3,
          profileName: 'Test Profile',
        },
      })
      expect(screen.getByText('Test Profile')).toBeInTheDocument()
    })

    it('shows "Universal Profile" when no profile name', () => {
      renderSection(connectedProps)
      expect(screen.getByText('Universal Profile')).toBeInTheDocument()
    })

    it('shows controllers count', () => {
      renderSection({
        ...connectedProps,
        profileData: {
          address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
          controllersCount: 5,
        },
      })
      expect(screen.getByText('5 controllers')).toBeInTheDocument()
    })

    it('uses singular "controller" for count of 1', () => {
      renderSection({
        ...connectedProps,
        profileData: {
          address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
          controllersCount: 1,
        },
      })
      expect(screen.getByText('1 controller')).toBeInTheDocument()
    })
  })

  describe('button interactions', () => {
    it('calls onConnectExtension when extension button clicked', () => {
      const onConnectExtension = vi.fn()
      renderSection({ onConnectExtension })

      fireEvent.click(screen.getByText('UP Browser Extension'))
      expect(onConnectExtension).toHaveBeenCalledTimes(1)
    })

    it('calls onConnectWalletConnect when WalletConnect button clicked', () => {
      const onConnectWalletConnect = vi.fn()
      renderSection({ onConnectWalletConnect })

      fireEvent.click(screen.getByText('WalletConnect'))
      expect(onConnectWalletConnect).toHaveBeenCalledTimes(1)
    })

    it('calls onDisconnect when disconnect button clicked', () => {
      const onDisconnect = vi.fn()
      renderSection({
        isConnected: true,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        onDisconnect,
      })

      fireEvent.click(screen.getByText('Disconnect'))
      expect(onDisconnect).toHaveBeenCalledTimes(1)
    })

    it('disables extension button when connecting', () => {
      renderSection({ isConnecting: true })
      const button = screen.getByText('Connecting...').closest('button')
      expect(button).toBeDisabled()
    })

    it('disables WalletConnect button when connecting', () => {
      renderSection({ isConnecting: true })
      const button = screen.getByText('WalletConnect').closest('button')
      expect(button).toBeDisabled()
    })

    it('shows spinner text when connecting', () => {
      renderSection({ isConnecting: true })
      expect(screen.getByText('Connecting...')).toBeInTheDocument()
    })
  })

  describe('error display', () => {
    it('shows error message when error is present', () => {
      renderSection({ error: 'Something went wrong' })
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('does not show error section when error is null', () => {
      const { container } = renderSection({ error: null })
      expect(container.querySelector('.bg-red-100')).not.toBeInTheDocument()
    })
  })
})
