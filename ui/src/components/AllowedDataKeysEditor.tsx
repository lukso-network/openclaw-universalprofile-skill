import { useState } from 'react'
import { DATA_KEY_PRESETS } from '../constants'
import type { DataKeyEntry } from '../utils'

interface AllowedDataKeysEditorProps {
  entries: DataKeyEntry[]
  onChange: (entries: DataKeyEntry[]) => void
}

export function AllowedDataKeysEditor({ entries, onChange }: AllowedDataKeysEditorProps) {
  const [customKeyInput, setCustomKeyInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const addPreset = (presetKey: string) => {
    const preset = DATA_KEY_PRESETS[presetKey]
    if (!preset) return
    // Don't add duplicates
    if (entries.some(e => e.key === preset.key)) return
    onChange([...entries, {
      id: crypto.randomUUID(),
      name: preset.name,
      key: preset.key,
      isPreset: true,
    }])
  }

  const addCustomKey = () => {
    const trimmed = customKeyInput.trim()
    if (!trimmed || !trimmed.startsWith('0x') || trimmed.length < 4) return
    if (entries.some(e => e.key === trimmed)) return
    onChange([...entries, {
      id: crypto.randomUUID(),
      name: 'Custom Key',
      key: trimmed,
      isPreset: false,
    }])
    setCustomKeyInput('')
    setShowCustomInput(false)
  }

  const removeEntry = (id: string) => {
    onChange(entries.filter(e => e.id !== id))
  }

  // Group presets by category
  const groups = Object.entries(DATA_KEY_PRESETS).reduce<Record<string, { key: string; preset: typeof DATA_KEY_PRESETS[string] }[]>>(
    (acc, [key, preset]) => {
      if (!acc[preset.group]) acc[preset.group] = []
      acc[preset.group].push({ key, preset })
      return acc
    },
    {}
  )

  const isPresetAdded = (presetKey: string) => {
    const preset = DATA_KEY_PRESETS[presetKey]
    return preset ? entries.some(e => e.key === preset.key) : false
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <svg className="w-5 h-5 text-lukso-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        Allowed Data Keys
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Optional)</span>
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Restrict which ERC725Y data keys this controller can write to.
        Leave empty to allow writing to all data keys.
      </p>

      {/* Quick-add presets by group */}
      <div className="space-y-3 mb-4">
        {Object.entries(groups).map(([groupName, presets]) => (
          <div key={groupName}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">{groupName}</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(({ key, preset }) => {
                const added = isPresetAdded(key)
                return (
                  <button
                    key={key}
                    onClick={() => !added && addPreset(key)}
                    disabled={added}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      added
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 cursor-default'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-lukso-pink hover:text-lukso-pink hover:bg-lukso-pink/5'
                    }`}
                    title={preset.description}
                  >
                    {added && (
                      <span className="mr-1">✓</span>
                    )}
                    {preset.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Configured keys list */}
      {entries.length > 0 && (
        <div className="space-y-2 mb-4">
          {entries.map(entry => {
            const byteLength = (entry.key.length - 2) / 2
            const isFullKey = byteLength === 32
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{entry.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isFullKey
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    }`}>
                      {isFullKey ? 'full key' : `${byteLength}B prefix`}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">{entry.key}</p>
                </div>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Custom key input */}
      {showCustomInput ? (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={customKeyInput}
            onChange={(e) => setCustomKeyInput(e.target.value)}
            placeholder="0x... (data key or prefix)"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono focus:ring-2 focus:ring-lukso-pink focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && addCustomKey()}
            autoFocus
          />
          <button
            onClick={addCustomKey}
            disabled={!customKeyInput.trim().startsWith('0x') || customKeyInput.trim().length < 4}
            className="px-3 py-2 rounded-lg bg-lukso-pink text-white text-sm font-medium hover:bg-lukso-pink/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Add
          </button>
          <button
            onClick={() => { setShowCustomInput(false); setCustomKeyInput('') }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowCustomInput(true)}
          className="w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-lukso-pink hover:text-lukso-pink transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Custom Data Key
        </button>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <div className="mt-3 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium">{entries.length}</span> data {entries.length === 1 ? 'key' : 'keys'} configured — controller can write to {entries.length === 1 ? 'this key' : 'any of these keys'}
          </p>
        </div>
      )}
    </div>
  )
}
