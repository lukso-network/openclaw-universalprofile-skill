import { useState, useCallback, useRef, useEffect } from 'react'
import { LuksoProfileAvatar } from './LuksoProfileAvatar'
import { formatAddress, convertIpfsUrl } from '../utils'
import type { Address } from 'viem'

const LUKSO_MAINNET_INDEXER = 'https://envio.lukso-mainnet.universal.tech/v1/graphql'

interface ProfileResult {
  id: string
  name: string | null
  fullName: string | null
  profileImageUrl: string | null
}

interface ProfileSearchProps {
  onSelect: (address: Address) => void
}

const SEARCH_QUERY = `
  query SearchProfiles($id: String!) {
    search_profiles(args: { search: $id }) {
      name
      fullName
      id
      profileImages(
        where: { error: { _is_null: true } }
        order_by: { width: asc }
      ) {
        width
        src
        url
        verified
      }
    }
  }
`

function getBestImageUrl(images: Array<{ width: number; src?: string; url?: string }>): string | null {
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => a.width - b.width)
  let best = sorted[0]
  let bestDiff = Math.abs(best.width - 200)
  for (const img of sorted) {
    const diff = Math.abs(img.width - 200)
    if (diff < bestDiff) {
      best = img
      bestDiff = diff
    }
  }
  const rawUrl = best.src || best.url
  if (!rawUrl) return null
  return convertIpfsUrl(rawUrl)
}

async function searchProfiles(query: string): Promise<ProfileResult[]> {
  const response = await fetch(LUKSO_MAINNET_INDEXER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { id: query },
    }),
  })

  if (!response.ok) return []

  const json = await response.json()
  const profiles = json?.data?.search_profiles
  if (!Array.isArray(profiles)) return []

  return profiles.map((p: {
    id: string
    name?: string
    fullName?: string
    profileImages?: Array<{ width: number; src?: string; url?: string }>
  }) => ({
    id: p.id,
    name: p.name || null,
    fullName: p.fullName || null,
    profileImageUrl: getBestImageUrl(p.profileImages || []),
  }))
}

export function ProfileSearch({ onSelect }: ProfileSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProfileResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([])
      setShowDropdown(false)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)
    try {
      const profiles = await searchProfiles(searchQuery)
      setResults(profiles)
      setShowDropdown(true)
    } catch (err) {
      console.error('[ProfileSearch] Search failed:', err)
      setResults([])
      setShowDropdown(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length >= 3) {
      debounceRef.current = setTimeout(() => doSearch(value), 400)
    } else {
      setResults([])
      setShowDropdown(false)
      setHasSearched(false)
    }
  }, [doSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.length >= 1) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      doSearch(query)
    }
  }, [query, doSearch])

  const handleSelect = useCallback((profile: ProfileResult) => {
    setShowDropdown(false)
    setQuery('')
    setResults([])
    setHasSearched(false)
    onSelect(profile.id as Address)
  }, [onSelect])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
          placeholder="Search for a Universal Profile..."
          className="input pl-10 pr-10 w-full"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <svg className="w-5 h-5 animate-spin text-lukso-pink" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.length === 0 && hasSearched && !isLoading && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
              No profiles found for "{query}"
            </div>
          )}
          {results.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              <LuksoProfileAvatar
                address={profile.id}
                profileUrl={profile.profileImageUrl}
                name={profile.name}
                size="sm"
                showIdenticon={true}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white truncate">
                  {profile.name || profile.fullName || 'Unnamed Profile'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {formatAddress(profile.id, 6)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
