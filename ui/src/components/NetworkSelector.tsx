import { CHAINS } from '../constants'

interface NetworkOption {
  chainId: number
  name: string
  symbol: string
  color: string
}

const NETWORKS: NetworkOption[] = [
  { chainId: CHAINS.lukso.id, name: 'LUKSO', symbol: 'LYX', color: 'bg-pink-500' },
  { chainId: CHAINS.base.id, name: 'Base', symbol: 'ETH', color: 'bg-blue-500' },
  { chainId: CHAINS.ethereum.id, name: 'Ethereum', symbol: 'ETH', color: 'bg-indigo-500' },
  { chainId: CHAINS.luksoTestnet.id, name: 'Testnet', symbol: 'LYXt', color: 'bg-amber-500' },
]

interface NetworkSelectorProps {
  currentChainId: number | null
  onSwitch: (chainId: number) => void
  isConnected: boolean
}

export function NetworkSelector({ currentChainId, onSwitch, isConnected }: NetworkSelectorProps) {
  const activeChainId = currentChainId ?? CHAINS.lukso.id

  return (
    <div className="flex items-center justify-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl">
      {NETWORKS.map((net) => {
        const isActive = activeChainId === net.chainId
        return (
          <button
            key={net.chainId}
            onClick={() => {
              if (!isActive) onSwitch(net.chainId)
            }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isActive
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
              }
            `}
            title={isConnected ? `Switch to ${net.name}` : net.name}
          >
            <span className={`w-2 h-2 rounded-full ${net.color} ${isActive ? 'animate-pulse' : 'opacity-50'}`} />
            <span className="hidden sm:inline">{net.name}</span>
            <span className="sm:hidden">{net.name.slice(0, 3)}</span>
          </button>
        )
      })}
    </div>
  )
}
