import { describe, it, expect } from 'vitest'
import { buildMappingKey } from './utils'
import { DATA_KEY_PRESETS } from './constants'
import { keccak256 } from 'viem'

describe('buildMappingKey', () => {
  it('produces a 32-byte hex string', () => {
    const prefix = '0x812c4334633eb816c80d0000' // LSP5ReceivedAssetsMap
    const address = '0x1234567890abcdef1234567890abcdef12345678'
    const result = buildMappingKey(prefix, address)
    // 0x + 64 hex chars = 32 bytes
    expect(result).toMatch(/^0x[a-f0-9]{64}$/)
  })

  it('starts with the 12-byte prefix', () => {
    const prefix = '0x812c4334633eb816c80d0000'
    const address = '0xdead000000000000000000000000000000000001'
    const result = buildMappingKey(prefix, address)
    expect(result.startsWith(prefix.toLowerCase())).toBe(true)
  })

  it('appends last 20 bytes of keccak256(address)', () => {
    const prefix = '0x74ac2555c10b9349e78f0000' // LSP12IssuedAssetsMap
    const address = '0x1234567890abcdef1234567890abcdef12345678'
    const result = buildMappingKey(prefix, address)
    
    const addressHash = keccak256(address.toLowerCase() as `0x${string}`)
    const last20 = addressHash.slice(-40)
    
    expect(result).toBe(`${prefix.toLowerCase()}${last20}`)
  })

  it('is case-insensitive for input address', () => {
    const prefix = '0x812c4334633eb816c80d0000'
    const addr1 = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
    const addr2 = '0xabcdef1234567890abcdef1234567890abcdef12'
    expect(buildMappingKey(prefix, addr1)).toBe(buildMappingKey(prefix, addr2))
  })

  it('produces different keys for different addresses', () => {
    const prefix = '0x812c4334633eb816c80d0000'
    const addr1 = '0x0000000000000000000000000000000000000001'
    const addr2 = '0x0000000000000000000000000000000000000002'
    expect(buildMappingKey(prefix, addr1)).not.toBe(buildMappingKey(prefix, addr2))
  })

  it('produces different keys for different prefixes', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678'
    const prefix1 = '0x812c4334633eb816c80d0000'
    const prefix2 = '0x74ac2555c10b9349e78f0000'
    expect(buildMappingKey(prefix1, address)).not.toBe(buildMappingKey(prefix2, address))
  })
})

describe('DATA_KEY_PRESETS', () => {
  it('all presets have required fields', () => {
    for (const [key, preset] of Object.entries(DATA_KEY_PRESETS)) {
      expect(preset.name, `${key} missing name`).toBeTruthy()
      expect(preset.key, `${key} missing key`).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(preset.description, `${key} missing description`).toBeTruthy()
      expect(preset.group, `${key} missing group`).toBeTruthy()
      expect(['Singleton', 'Mapping', 'Array'], `${key} invalid keyType`).toContain(preset.keyType)
    }
  })

  it('Mapping presets have 12-byte keys (prefixes)', () => {
    const mappingPresets = Object.entries(DATA_KEY_PRESETS).filter(([, p]) => p.keyType === 'Mapping')
    expect(mappingPresets.length).toBeGreaterThan(0)
    for (const [key, preset] of mappingPresets) {
      const byteLen = (preset.key.length - 2) / 2
      expect(byteLen, `${key} should be 12 bytes but is ${byteLen}`).toBe(12)
    }
  })

  it('Singleton presets have 32-byte keys', () => {
    const singletonPresets = Object.entries(DATA_KEY_PRESETS).filter(([, p]) => p.keyType === 'Singleton')
    expect(singletonPresets.length).toBeGreaterThan(0)
    for (const [key, preset] of singletonPresets) {
      const byteLen = (preset.key.length - 2) / 2
      expect(byteLen, `${key} should be 32 bytes but is ${byteLen}`).toBe(32)
    }
  })

  it('Array presets have 32-byte keys', () => {
    const arrayPresets = Object.entries(DATA_KEY_PRESETS).filter(([, p]) => p.keyType === 'Array')
    expect(arrayPresets.length).toBeGreaterThan(0)
    for (const [key, preset] of arrayPresets) {
      const byteLen = (preset.key.length - 2) / 2
      expect(byteLen, `${key} should be 32 bytes but is ${byteLen}`).toBe(32)
    }
  })
})
