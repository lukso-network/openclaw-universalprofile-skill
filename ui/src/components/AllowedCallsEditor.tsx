import { useState, useMemo } from 'react'
import { INTERFACE_PRESETS } from '../constants'
import { computeSelector, type AllowedCallEntry } from '../utils'

interface AllowedCallsEditorProps {
  entries: AllowedCallEntry[]
  onChange: (entries: AllowedCallEntry[]) => void
}

function createEmptyEntry(): AllowedCallEntry {
  return {
    id: crypto.randomUUID(),
    callTypes: { call: true, staticCall: false, delegateCall: false },
    address: '',
    useAnyAddress: true,
    interfaceId: '',
    useAnyInterface: true,
    functionInput: '',
    useAnyFunction: true,
  }
}

export function AllowedCallsEditor({ entries, onChange }: AllowedCallsEditorProps) {
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)

  const addEntry = () => {
    const newEntry = createEmptyEntry()
    onChange([...entries, newEntry])
    setExpandedEntry(newEntry.id)
  }

  const removeEntry = (id: string) => {
    onChange(entries.filter(e => e.id !== id))
  }

  const updateEntry = (id: string, updates: Partial<AllowedCallEntry>) => {
    onChange(entries.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-lukso-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Allowed Calls
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Optional)</span>
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Restrict which contracts, functions, or standards this controller can interact with.
        Leave empty to allow all targets.
      </p>

      {entries.length > 0 && (
        <div className="space-y-3 mb-4">
          {entries.map((entry, index) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              index={index}
              isExpanded={expandedEntry === entry.id}
              onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
              onUpdate={(updates) => updateEntry(entry.id, updates)}
              onRemove={() => removeEntry(entry.id)}
            />
          ))}
        </div>
      )}

      <button
        onClick={addEntry}
        className="w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-lukso-pink hover:text-lukso-pink transition-all text-sm font-medium flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Allowed Call Entry
      </button>

      {/* Summary */}
      {entries.length > 0 && (
        <div className="mt-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium">{entries.length}</span> {entries.length === 1 ? 'entry' : 'entries'} configured — controller can interact with {entries.length === 1 ? 'this target' : 'any of these targets'}
          </p>
        </div>
      )}
    </div>
  )
}

interface EntryCardProps {
  entry: AllowedCallEntry
  index: number
  isExpanded: boolean
  onToggle: () => void
  onUpdate: (updates: Partial<AllowedCallEntry>) => void
  onRemove: () => void
}

function EntryCard({ entry, index, isExpanded, onToggle, onUpdate, onRemove }: EntryCardProps) {
  const computedSelector = useMemo(() => {
    if (entry.useAnyFunction || !entry.functionInput) return null
    return computeSelector(entry.functionInput)
  }, [entry.functionInput, entry.useAnyFunction])

  const summary = useMemo(() => {
    const parts: string[] = []
    const types: string[] = []
    if (entry.callTypes.call) types.push('CALL')
    if (entry.callTypes.staticCall) types.push('STATICCALL')
    if (entry.callTypes.delegateCall) types.push('DELEGATECALL')
    parts.push(types.join('+') || 'No call type')

    if (entry.useAnyAddress) {
      parts.push('any address')
    } else if (entry.address) {
      parts.push(`${entry.address.slice(0, 8)}...`)
    }

    if (!entry.useAnyInterface && entry.interfaceId) {
      const preset = Object.values(INTERFACE_PRESETS).find(p => p.id === entry.interfaceId)
      parts.push(preset ? preset.name : entry.interfaceId)
    }

    if (!entry.useAnyFunction && entry.functionInput) {
      parts.push(computedSelector || entry.functionInput)
    }

    return parts.join(' → ')
  }, [entry, computedSelector])

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500">#{index + 1}</span>
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{summary}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title="Remove entry"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Call Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Call Types</label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'call' as const, label: 'Call', desc: 'Execute transactions' },
                { key: 'staticCall' as const, label: 'Static Call', desc: 'Read-only queries' },
                { key: 'delegateCall' as const, label: 'Delegate Call', desc: '⚠️ Dangerous' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entry.callTypes[key]}
                    onChange={(e) => onUpdate({ callTypes: { ...entry.callTypes, [key]: e.target.checked } })}
                    className="rounded border-gray-300 text-lukso-pink focus:ring-lukso-pink"
                  />
                  <span className="text-sm">
                    {label}
                    <span className="text-xs text-gray-400 ml-1">({desc})</span>
                  </span>
                </label>
              ))}
            </div>
            {entry.callTypes.delegateCall && (
              <p className="mt-1 text-xs text-red-500">⚠️ Delegate call allows executing code in the profile's context — extremely dangerous!</p>
            )}
            {!entry.callTypes.call && !entry.callTypes.staticCall && !entry.callTypes.delegateCall && (
              <p className="mt-1 text-xs text-red-500">At least one call type must be selected</p>
            )}
          </div>

          {/* Target Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Address</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.useAnyAddress}
                  onChange={(e) => onUpdate({ useAnyAddress: e.target.checked })}
                  className="rounded border-gray-300 text-lukso-pink focus:ring-lukso-pink"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Any address</span>
              </label>
            </div>
            {!entry.useAnyAddress && (
              <input
                type="text"
                value={entry.address}
                onChange={(e) => onUpdate({ address: e.target.value })}
                placeholder="0x..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-lukso-pink focus:border-transparent"
              />
            )}
            {!entry.useAnyAddress && entry.address && !/^0x[a-fA-F0-9]{40}$/.test(entry.address) && (
              <p className="mt-1 text-xs text-red-500">Invalid address format</p>
            )}
          </div>

          {/* Interface Standard */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Interface Standard</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.useAnyInterface}
                  onChange={(e) => onUpdate({ useAnyInterface: e.target.checked })}
                  className="rounded border-gray-300 text-lukso-pink focus:ring-lukso-pink"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Any interface</span>
              </label>
            </div>
            {!entry.useAnyInterface && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(INTERFACE_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => onUpdate({ interfaceId: preset.id })}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        entry.interfaceId === preset.id
                          ? 'border-lukso-pink bg-lukso-pink/10 text-lukso-pink'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-lukso-pink hover:text-lukso-pink'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={entry.interfaceId}
                  onChange={(e) => onUpdate({ interfaceId: e.target.value })}
                  placeholder="0xNNNNNNNN (4 bytes)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-lukso-pink focus:border-transparent"
                />
              </>
            )}
          </div>

          {/* Function Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Function</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={entry.useAnyFunction}
                  onChange={(e) => onUpdate({ useAnyFunction: e.target.checked })}
                  className="rounded border-gray-300 text-lukso-pink focus:ring-lukso-pink"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Any function</span>
              </label>
            </div>
            {!entry.useAnyFunction && (
              <>
                <input
                  type="text"
                  value={entry.functionInput}
                  onChange={(e) => onUpdate({ functionInput: e.target.value })}
                  placeholder="0xaabbccdd or transfer(address,uint256)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-lukso-pink focus:border-transparent"
                />
                {entry.functionInput && (
                  <p className={`mt-1 text-xs ${computedSelector ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {computedSelector
                      ? `→ Selector: ${computedSelector}`
                      : 'Invalid function signature or selector'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
