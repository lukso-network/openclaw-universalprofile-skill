/**
 * Permission System - Encoding, Decoding, Presets, Validation
 */

import { ethers } from 'ethers';
import {
  PERMISSIONS,
  DATA_KEYS,
  INTERFACE_IDS,
  type PermissionName,
} from '../utils/constants.js';
import {
  PermissionPreset,
  PermissionPresetConfig,
  PermissionValidation,
  AllowedCallsConfig,
} from '../types/index.js';

// ==================== PERMISSION PRESETS ====================

export const PERMISSION_PRESETS: Record<PermissionPreset, PermissionPresetConfig> = {
  'read-only': {
    name: 'Read Only',
    description: 'Can only read data, cannot make changes',
    permissions: PERMISSIONS.STATICCALL,
    riskLevel: 'low',
  },
  'token-operator': {
    name: 'Token Operator',
    description: 'Can transfer tokens and NFTs',
    permissions: combinePermissions(['CALL', 'TRANSFERVALUE']),
    allowedCalls: {
      callTypes: [0x00000003], // CALL + TRANSFERVALUE
      addresses: [], // Any
      interfaceIds: [
        INTERFACE_IDS.LSP7DigitalAsset,
        INTERFACE_IDS.LSP8IdentifiableDigitalAsset,
      ],
      functionSelectors: [
        '0x760d9bba', // transfer(address,address,uint256,bool,bytes) - LSP7
        '0x511b6952', // transfer(address,address,bytes32,bool,bytes) - LSP8
        '0xb49506fd', // authorizeOperator - LSP7
        '0x86a10ddd', // authorizeOperator - LSP8
      ],
    },
    riskLevel: 'medium',
  },
  'nft-trader': {
    name: 'NFT Trader',
    description: 'Can trade NFTs on marketplaces and transfer tokens',
    permissions: combinePermissions(['CALL', 'TRANSFERVALUE']),
    allowedCalls: {
      callTypes: [0x00000003],
      addresses: [], // Will be populated with marketplace address
      interfaceIds: [INTERFACE_IDS.LSP8IdentifiableDigitalAsset],
      functionSelectors: [], // Any function
    },
    riskLevel: 'medium',
  },
  'defi-trader': {
    name: 'DeFi Trader',
    description: 'Full DeFi access: DEX swaps, marketplace, token operations',
    permissions: combinePermissions(['CALL', 'TRANSFERVALUE']),
    allowedCalls: {
      callTypes: [0x00000003],
      addresses: [], // Will include router + marketplace
      interfaceIds: [
        INTERFACE_IDS.LSP7DigitalAsset,
        INTERFACE_IDS.LSP8IdentifiableDigitalAsset,
      ],
      functionSelectors: [], // Any function
    },
    riskLevel: 'medium-high',
  },
  'profile-manager': {
    name: 'Profile Manager',
    description: 'Can update profile data and metadata',
    permissions: combinePermissions(['SETDATA', 'CALL']),
    allowedDataKeys: [
      '0x5ef83ad9', // LSP3Profile prefix
      '0x6460ee3c', // LSP5ReceivedAssets prefix
    ],
    riskLevel: 'medium',
  },
  'full-access': {
    name: 'Full Access',
    description: 'Complete control over Universal Profile (use with extreme caution)',
    permissions: PERMISSIONS.ALL_PERMISSIONS,
    riskLevel: 'critical',
  },
};

// ==================== PERMISSION ENCODING ====================

/**
 * Combine multiple permissions into a single hex value
 */
export function combinePermissions(permissions: PermissionName[]): string {
  let combined = 0n;

  for (const perm of permissions) {
    const value = PERMISSIONS[perm];
    if (value) {
      combined |= BigInt(value);
    }
  }

  return ethers.zeroPadValue(ethers.toBeHex(combined), 32);
}

/**
 * Decode a permission hex value into permission names
 */
export function decodePermissions(permissionHex: string): PermissionName[] {
  const permValue = BigInt(permissionHex);
  const result: PermissionName[] = [];

  for (const [name, value] of Object.entries(PERMISSIONS)) {
    if ((permValue & BigInt(value)) !== 0n) {
      result.push(name as PermissionName);
    }
  }

  return result;
}

/**
 * Check if a permission hex value includes a specific permission
 */
export function hasPermission(
  permissionHex: string,
  permission: PermissionName
): boolean {
  const permValue = BigInt(permissionHex);
  const checkValue = BigInt(PERMISSIONS[permission]);
  return (permValue & checkValue) !== 0n;
}

/**
 * Get the permission data key for a controller address
 */
export function getPermissionDataKey(controllerAddress: string): string {
  return (
    DATA_KEYS['AddressPermissions:Permissions'] +
    controllerAddress.slice(2).toLowerCase()
  );
}

/**
 * Get the allowed calls data key for a controller address
 */
export function getAllowedCallsDataKey(controllerAddress: string): string {
  return (
    DATA_KEYS['AddressPermissions:AllowedCalls'] +
    controllerAddress.slice(2).toLowerCase()
  );
}

/**
 * Get the allowed data keys data key for a controller address
 */
export function getAllowedDataKeysDataKey(controllerAddress: string): string {
  return (
    DATA_KEYS['AddressPermissions:AllowedERC725YDataKeys'] +
    controllerAddress.slice(2).toLowerCase()
  );
}

// ==================== ALLOWED CALLS ENCODING ====================

/**
 * Encode allowed calls for a controller
 * 
 * Format: CompactBytesArray of entries
 * Each entry: [CallType (4 bytes)][Address (20 bytes)][InterfaceId (4 bytes)][Selector (4 bytes)]
 */
export function encodeAllowedCalls(config: AllowedCallsConfig): string {
  if (
    config.addresses.length === 0 &&
    config.interfaceIds.length === 0 &&
    config.functionSelectors.length === 0
  ) {
    return '0x'; // No restrictions (but this might not be what you want)
  }

  const entries: string[] = [];

  // Create entries for each combination
  const addresses =
    config.addresses.length > 0
      ? config.addresses
      : ['0xffffffffffffffffffffffffffffffffffffffff']; // Any address

  const interfaceIds =
    config.interfaceIds.length > 0
      ? config.interfaceIds
      : ['0xffffffff']; // Any interface

  const selectors =
    config.functionSelectors.length > 0
      ? config.functionSelectors
      : ['0xffffffff']; // Any function

  for (const callType of config.callTypes) {
    for (const address of addresses) {
      for (const interfaceId of interfaceIds) {
        for (const selector of selectors) {
          const entry =
            ethers.zeroPadValue(ethers.toBeHex(callType), 4).slice(2) +
            address.slice(2).toLowerCase().padStart(40, '0') +
            interfaceId.slice(2).padStart(8, '0') +
            selector.slice(2).padStart(8, '0');

          entries.push(entry);
        }
      }
    }
  }

  // Encode as CompactBytesArray
  // Each entry is 32 bytes, prefixed with 2-byte length
  let result = '0x';
  for (const entry of entries) {
    const entryBytes = entry.length / 2;
    const lengthPrefix = entryBytes.toString(16).padStart(4, '0');
    result += lengthPrefix + entry;
  }

  return result;
}

/**
 * Encode allowed ERC725Y data keys
 * 
 * Format: CompactBytesArray of key prefixes
 */
export function encodeAllowedDataKeys(keyPrefixes: string[]): string {
  if (keyPrefixes.length === 0) {
    return '0x';
  }

  let result = '0x';
  for (const prefix of keyPrefixes) {
    const prefixHex = prefix.startsWith('0x') ? prefix.slice(2) : prefix;
    const length = prefixHex.length / 2;
    const lengthPrefix = length.toString(16).padStart(4, '0');
    result += lengthPrefix + prefixHex;
  }

  return result;
}

// ==================== PERMISSION VALIDATION ====================

/**
 * Validate requested permissions and return warnings/risks
 */
export function validatePermissions(permissionHex: string): PermissionValidation {
  const warnings: string[] = [];
  const risks: string[] = [];

  const perms = BigInt(permissionHex);

  // Critical permissions (should never be granted to untrusted controllers)
  if (perms & BigInt(PERMISSIONS.CHANGEOWNER)) {
    risks.push('CHANGEOWNER: Can transfer profile ownership');
  }
  if (perms & BigInt(PERMISSIONS.SUPER_DELEGATECALL)) {
    risks.push('SUPER_DELEGATECALL: Can execute arbitrary code in UP context');
  }
  if (perms & BigInt(PERMISSIONS.DELEGATECALL)) {
    risks.push('DELEGATECALL: Can execute code in UP context (with restrictions)');
  }

  // High risk permissions
  if (perms & BigInt(PERMISSIONS.EDITPERMISSIONS)) {
    warnings.push('EDITPERMISSIONS: Can modify other controllers permissions');
  }
  if (perms & BigInt(PERMISSIONS.ADDCONTROLLER)) {
    warnings.push('ADDCONTROLLER: Can add new controllers');
  }
  if (perms & BigInt(PERMISSIONS.SUPER_SETDATA)) {
    warnings.push('SUPER_SETDATA: Can modify any data on profile');
  }
  if (perms & BigInt(PERMISSIONS.SUPER_CALL)) {
    warnings.push('SUPER_CALL: Can call any contract without restrictions');
  }
  if (perms & BigInt(PERMISSIONS.SUPER_TRANSFERVALUE)) {
    warnings.push('SUPER_TRANSFERVALUE: Can transfer any amount to any address');
  }

  // Medium risk permissions
  if (perms & BigInt(PERMISSIONS.DEPLOY)) {
    warnings.push('DEPLOY: Can deploy new contracts from UP');
  }

  return {
    valid: risks.length === 0,
    warnings,
    risks,
  };
}

/**
 * Get a human-readable description of permissions
 */
export function describePermissions(permissionHex: string): string[] {
  const decoded = decodePermissions(permissionHex);

  const descriptions: Record<PermissionName, string> = {
    CHANGEOWNER: 'Change profile ownership',
    ADDCONTROLLER: 'Add new controllers',
    EDITPERMISSIONS: 'Edit controller permissions',
    ADDEXTENSIONS: 'Add extensions',
    CHANGEEXTENSIONS: 'Change extensions',
    ADDUNIVERSALRECEIVERDELEGATE: 'Add universal receiver delegates',
    CHANGEUNIVERSALRECEIVERDELEGATE: 'Change universal receiver delegates',
    REENTRANCY: 'Allow reentrancy',
    SUPER_TRANSFERVALUE: 'Transfer value (unrestricted)',
    TRANSFERVALUE: 'Transfer value (with restrictions)',
    SUPER_CALL: 'Call contracts (unrestricted)',
    CALL: 'Call contracts (with restrictions)',
    SUPER_STATICCALL: 'Static call contracts (unrestricted)',
    STATICCALL: 'Static call contracts (with restrictions)',
    SUPER_DELEGATECALL: 'Delegate call (unrestricted)',
    DELEGATECALL: 'Delegate call (with restrictions)',
    DEPLOY: 'Deploy contracts',
    SUPER_SETDATA: 'Set data (unrestricted)',
    SETDATA: 'Set data (with restrictions)',
    ENCRYPT: 'Encrypt data',
    DECRYPT: 'Decrypt data',
    SIGN: 'Sign messages',
    EXECUTE_RELAY_CALL: 'Execute relay calls',
    ALL_PERMISSIONS: 'All permissions',
  };

  return decoded.map((perm) => descriptions[perm] || perm);
}

/**
 * Get preset configuration by name
 */
export function getPresetConfig(preset: PermissionPreset): PermissionPresetConfig {
  return PERMISSION_PRESETS[preset];
}

/**
 * List all available presets
 */
export function listPresets(): { name: PermissionPreset; config: PermissionPresetConfig }[] {
  return Object.entries(PERMISSION_PRESETS).map(([name, config]) => ({
    name: name as PermissionPreset,
    config,
  }));
}
