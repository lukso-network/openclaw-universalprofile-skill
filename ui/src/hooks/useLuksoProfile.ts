import { useState, useEffect, useRef } from 'react'
import { createPublicClient, http, type Address, type Hex, type Chain } from 'viem'
import { CHAINS, LSP0_ABI, DATA_KEYS } from '../constants'
import { convertIpfsUrl, fetchProfileFromIndexer } from '../utils'

export interface LuksoProfileData {
  name: string | null
  profileImageUrl: string | null
}

// Singleton LUKSO mainnet public client for profile metadata reads
const luksoPublicClient = createPublicClient({
  chain: CHAINS.lukso as unknown as Chain,
  transport: http(CHAINS.lukso.rpcUrls.default.http[0]),
})

/**
 * Fetch profile metadata (name, image) from LUKSO mainnet.
 * Tries the Envio indexer first, falls back to on-chain LSP3 data.
 */
export async function fetchLuksoProfileData(address: string): Promise<LuksoProfileData> {
  // Try indexer first (fast, pre-parsed)
  try {
    const indexerProfile = await fetchProfileFromIndexer(address)
    if (indexerProfile && (indexerProfile.name || indexerProfile.profileImageUrl)) {
      return {
        name: indexerProfile.name,
        profileImageUrl: indexerProfile.profileImageUrl,
      }
    }
  } catch (err) {
    console.error('[useLuksoProfile] Indexer fetch failed:', err)
  }

  // Fallback: read LSP3Profile on-chain from LUKSO mainnet
  let name: string | null = null
  let profileImageUrl: string | null = null

  try {
    const profileDataHex = await luksoPublicClient.readContract({
      address: address as Address,
      abi: LSP0_ABI,
      functionName: 'getData',
      args: [DATA_KEYS['LSP3Profile'] as Hex],
    }) as Hex

    if (profileDataHex && profileDataHex !== '0x' && profileDataHex.length > 10) {
      const urlHex = profileDataHex.slice(2 + 72)
      const urlBytes = urlHex.match(/.{1,2}/g)
      if (urlBytes) {
        let jsonUrl = ''
        for (const byte of urlBytes) {
          const charCode = parseInt(byte, 16)
          if (charCode === 0) break
          jsonUrl += String.fromCharCode(charCode)
        }

        if (jsonUrl) {
          const httpUrl = convertIpfsUrl(jsonUrl)
          const response = await fetch(httpUrl)
          if (response.ok) {
            const profileJson = await response.json()
            name = profileJson.LSP3Profile?.name || profileJson.name || null

            const images = profileJson.LSP3Profile?.profileImage || profileJson.profileImage
            if (images && images.length > 0) {
              const imageUrl = typeof images[0] === 'string' ? images[0] : images[0]?.url
              if (imageUrl) {
                profileImageUrl = convertIpfsUrl(imageUrl)
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[useLuksoProfile] On-chain LSP3 fetch failed:', err)
  }

  return { name, profileImageUrl }
}

/**
 * React hook: fetch profile metadata from LUKSO mainnet for a given address.
 * Always reads from LUKSO (chain 42) regardless of the currently selected chain.
 */
export function useLuksoProfile(address: string | null) {
  const [data, setData] = useState<LuksoProfileData>({ name: null, profileImageUrl: null })
  const [loading, setLoading] = useState(false)
  const lastFetchedAddress = useRef<string | null>(null)

  useEffect(() => {
    if (!address) {
      setData({ name: null, profileImageUrl: null })
      lastFetchedAddress.current = null
      return
    }

    const normalized = address.toLowerCase()
    if (lastFetchedAddress.current === normalized) return
    lastFetchedAddress.current = normalized

    let cancelled = false
    setLoading(true)

    fetchLuksoProfileData(address).then(result => {
      if (!cancelled) {
        setData(result)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [address])

  return { ...data, loading }
}
