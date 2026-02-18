/**
 * Universal Profile Management
 */

import { ethers, Contract, Provider } from 'ethers';
import { LSP0_ABI } from '../contracts/lsp0.js';
import { LSP6_ABI } from '../contracts/lsp6.js';
import { DATA_KEYS, INTERFACE_IDS } from '../utils/constants.js';
import { decodePermissions } from './permissions.js';
import {
  UniversalProfileInfo,
  ControllerInfo,
  UniversalProfileError,
  ERROR_CODES,
} from '../types/index.js';

// ==================== PROFILE INFO ====================

/**
 * Get comprehensive information about a Universal Profile
 */
export async function getProfileInfo(
  address: string,
  provider: Provider
): Promise<UniversalProfileInfo> {
  // Validate address
  if (!ethers.isAddress(address)) {
    throw new UniversalProfileError(
      `Invalid address: ${address}`,
      ERROR_CODES.INVALID_ADDRESS
    );
  }

  // Check if UP exists
  const code = await provider.getCode(address);
  if (code === '0x') {
    throw new UniversalProfileError(
      `No contract found at address: ${address}`,
      ERROR_CODES.NOT_AUTHORIZED
    );
  }

  const up = new Contract(address, LSP0_ABI, provider);

  // Check if it's a UP by interface
  const isUP = await up.supportsInterface(INTERFACE_IDS.LSP0ERC725Account).catch(() => false);
  if (!isUP) {
    throw new UniversalProfileError(
      `Address is not a Universal Profile: ${address}`,
      ERROR_CODES.INVALID_ADDRESS
    );
  }

  // Get owner (Key Manager)
  const owner = await up.owner();

  // Get balance
  const balance = await provider.getBalance(address);

  // Get profile metadata
  let name: string | undefined;
  let description: string | undefined;

  try {
    const profileData = await up.getData(DATA_KEYS.LSP3Profile);
    if (profileData && profileData !== '0x') {
      const decoded = decodeProfileMetadata(profileData);
      name = decoded.name;
      description = decoded.description;
    }
  } catch {
    // Profile metadata not set or invalid
  }

  // Get controllers
  const controllers = await getControllers(address, provider);

  // Get received assets
  const receivedAssets = await getReceivedAssets(address, provider);

  return {
    address,
    name,
    description,
    keyManager: owner,
    owner,
    balance,
    controllers,
    receivedAssets,
  };
}

/**
 * Decode LSP3 profile metadata
 */
function decodeProfileMetadata(
  data: string
): { name?: string; description?: string; links?: any[]; tags?: string[] } {
  // LSP3 metadata is VerifiableURI format
  // First 2 bytes are hash function, next 32 bytes are hash, rest is URL
  // For simplicity, we'll handle common IPFS format

  try {
    // Check if it's a JSON-URL format (0x6f357c6a prefix)
    if (data.startsWith('0x6f357c6a')) {
      // Extract the JSON URL
      // This is simplified - real implementation would fetch from IPFS
      return {};
    }

    // Try direct JSON parsing (not standard, but sometimes used)
    const decoded = ethers.toUtf8String(data);
    const json = JSON.parse(decoded);
    return {
      name: json.LSP3Profile?.name || json.name,
      description: json.LSP3Profile?.description || json.description,
      links: json.LSP3Profile?.links || json.links,
      tags: json.LSP3Profile?.tags || json.tags,
    };
  } catch {
    return {};
  }
}

// ==================== CONTROLLERS ====================

/**
 * Get all controllers for a Universal Profile
 */
export async function getControllers(
  upAddress: string,
  provider: Provider
): Promise<ControllerInfo[]> {
  const up = new Contract(upAddress, LSP0_ABI, provider);

  // Get controller array length
  const lengthData = await up.getData(DATA_KEYS['AddressPermissions[]'].length);
  if (!lengthData || lengthData === '0x') {
    return [];
  }

  const length = parseInt(lengthData, 16);
  const controllers: ControllerInfo[] = [];

  // Get each controller
  for (let i = 0; i < length; i++) {
    const indexKey =
      DATA_KEYS['AddressPermissions[]'].index +
      ethers.zeroPadValue(ethers.toBeHex(i), 16).slice(2);

    const controllerAddress = await up.getData(indexKey);
    if (!controllerAddress || controllerAddress === '0x') continue;

    // Format address (it's stored as 32 bytes)
    const address = ethers.getAddress('0x' + controllerAddress.slice(-40));

    // Get permissions
    const permissionKey =
      DATA_KEYS['AddressPermissions:Permissions'] + address.slice(2).toLowerCase();
    const permissions = await up.getData(permissionKey);

    // Get allowed calls (optional)
    const allowedCallsKey =
      DATA_KEYS['AddressPermissions:AllowedCalls'] + address.slice(2).toLowerCase();
    let allowedCalls: string | undefined;
    try {
      const acData = await up.getData(allowedCallsKey);
      if (acData && acData !== '0x') {
        allowedCalls = acData;
      }
    } catch {
      // Not set
    }

    // Get allowed data keys (optional)
    const allowedDataKeysKey =
      DATA_KEYS['AddressPermissions:AllowedERC725YDataKeys'] +
      address.slice(2).toLowerCase();
    let allowedDataKeys: string | undefined;
    try {
      const adkData = await up.getData(allowedDataKeysKey);
      if (adkData && adkData !== '0x') {
        allowedDataKeys = adkData;
      }
    } catch {
      // Not set
    }

    controllers.push({
      address,
      permissions: permissions || '0x',
      decodedPermissions: permissions ? decodePermissions(permissions) : [],
      allowedCalls,
      allowedDataKeys,
    });
  }

  return controllers;
}

/**
 * Check if an address is a controller for a UP
 */
export async function isController(
  upAddress: string,
  controllerAddress: string,
  provider: Provider
): Promise<boolean> {
  const up = new Contract(upAddress, LSP0_ABI, provider);

  const permissionKey =
    DATA_KEYS['AddressPermissions:Permissions'] +
    controllerAddress.slice(2).toLowerCase();

  const permissions = await up.getData(permissionKey);

  return permissions && permissions !== '0x' && BigInt(permissions) !== 0n;
}

/**
 * Get permissions for a specific controller
 */
export async function getControllerPermissions(
  upAddress: string,
  controllerAddress: string,
  provider: Provider
): Promise<string | null> {
  const up = new Contract(upAddress, LSP0_ABI, provider);

  const permissionKey =
    DATA_KEYS['AddressPermissions:Permissions'] +
    controllerAddress.slice(2).toLowerCase();

  const permissions = await up.getData(permissionKey);

  if (!permissions || permissions === '0x') {
    return null;
  }

  return permissions;
}

// ==================== RECEIVED ASSETS ====================

/**
 * Get received assets (LSP5) for a Universal Profile
 */
export async function getReceivedAssets(
  upAddress: string,
  provider: Provider
): Promise<{ lsp7: string[]; lsp8: string[] }> {
  const up = new Contract(upAddress, LSP0_ABI, provider);

  const lsp7: string[] = [];
  const lsp8: string[] = [];

  try {
    // Get received assets array length
    const lengthData = await up.getData(
      DATA_KEYS['LSP5ReceivedAssets[]'].length
    );
    if (!lengthData || lengthData === '0x') {
      return { lsp7, lsp8 };
    }

    const length = parseInt(lengthData, 16);

    // Get each asset
    for (let i = 0; i < length; i++) {
      const indexKey =
        DATA_KEYS['LSP5ReceivedAssets[]'].index +
        ethers.zeroPadValue(ethers.toBeHex(i), 16).slice(2);

      const assetData = await up.getData(indexKey);
      if (!assetData || assetData === '0x') continue;

      const assetAddress = ethers.getAddress('0x' + assetData.slice(-40));

      // Check if LSP7 or LSP8
      const assetContract = new Contract(
        assetAddress,
        ['function supportsInterface(bytes4) view returns (bool)'],
        provider
      );

      try {
        const isLSP7 = await assetContract.supportsInterface(
          INTERFACE_IDS.LSP7DigitalAsset
        );
        if (isLSP7) {
          lsp7.push(assetAddress);
          continue;
        }
      } catch {
        // Not LSP7
      }

      try {
        const isLSP8 = await assetContract.supportsInterface(
          INTERFACE_IDS.LSP8IdentifiableDigitalAsset
        );
        if (isLSP8) {
          lsp8.push(assetAddress);
        }
      } catch {
        // Not LSP8
      }
    }
  } catch {
    // Error reading received assets
  }

  return { lsp7, lsp8 };
}

// ==================== DATA OPERATIONS ====================

/**
 * Get data from Universal Profile
 */
export async function getData(
  upAddress: string,
  dataKey: string,
  provider: Provider
): Promise<string> {
  const up = new Contract(upAddress, LSP0_ABI, provider);
  return up.getData(dataKey);
}

/**
 * Get multiple data values from Universal Profile
 */
export async function getDataBatch(
  upAddress: string,
  dataKeys: string[],
  provider: Provider
): Promise<string[]> {
  const up = new Contract(upAddress, LSP0_ABI, provider);
  return up.getDataBatch(dataKeys);
}

// ==================== KEY MANAGER ====================

/**
 * Get the Key Manager address for a Universal Profile
 */
export async function getKeyManager(
  upAddress: string,
  provider: Provider
): Promise<string> {
  const up = new Contract(upAddress, LSP0_ABI, provider);
  return up.owner();
}

/**
 * Verify that an address is a valid Key Manager for a UP
 */
export async function verifyKeyManager(
  upAddress: string,
  keyManagerAddress: string,
  provider: Provider
): Promise<boolean> {
  // Check UP's owner is the Key Manager
  const up = new Contract(upAddress, LSP0_ABI, provider);
  const owner = await up.owner();

  if (owner.toLowerCase() !== keyManagerAddress.toLowerCase()) {
    return false;
  }

  // Check Key Manager's target is the UP
  const km = new Contract(keyManagerAddress, LSP6_ABI, provider);
  const target: string = await km.getFunction('target')();

  return target.toLowerCase() === upAddress.toLowerCase();
}
