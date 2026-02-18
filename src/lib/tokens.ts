/**
 * Token Management - LSP7 and LSP8 Operations
 */

import { ethers, Contract, Provider } from 'ethers';
import { LSP7_ABI, LSP7_MINTABLE_ABI } from '../contracts/lsp7.js';
import { LSP8_ABI, LSP8_MINTABLE_ABI, LSP8_TOKEN_ID_FORMAT } from '../contracts/lsp8.js';
import { INTERFACE_IDS, OPERATION_TYPES, DATA_KEYS } from '../utils/constants.js';
import {
  LSP7TokenInfo,
  LSP8CollectionInfo,
  ExecuteParams,
  UniversalProfileError,
  ERROR_CODES,
} from '../types/index.js';

// ==================== LSP7 TOKEN INFO ====================

/**
 * Get LSP7 token information
 */
export async function getLSP7Info(
  tokenAddress: string,
  provider: Provider
): Promise<LSP7TokenInfo> {
  const token = new Contract(tokenAddress, LSP7_ABI, provider);

  // Verify it's LSP7
  const isLSP7 = await token
    .supportsInterface(INTERFACE_IDS.LSP7DigitalAsset)
    .catch(() => false);
  if (!isLSP7) {
    throw new UniversalProfileError(
      `Address is not an LSP7 token: ${tokenAddress}`,
      ERROR_CODES.INVALID_ADDRESS
    );
  }

  const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply(),
    token.owner(),
  ]);

  // Check if non-divisible (decimals = 0)
  const isNonDivisible = Number(decimals) === 0;

  return {
    address: tokenAddress,
    name,
    symbol,
    decimals: Number(decimals),
    totalSupply,
    owner,
    isNonDivisible,
  };
}

/**
 * Get LSP7 token balance for an address
 */
export async function getLSP7Balance(
  tokenAddress: string,
  holderAddress: string,
  provider: Provider
): Promise<bigint> {
  const token = new Contract(tokenAddress, LSP7_ABI, provider);
  return token.balanceOf(holderAddress);
}

/**
 * Get authorized operator amount for LSP7
 */
export async function getLSP7AuthorizedAmount(
  tokenAddress: string,
  operatorAddress: string,
  holderAddress: string,
  provider: Provider
): Promise<bigint> {
  const token = new Contract(tokenAddress, LSP7_ABI, provider);
  return token.authorizedAmountFor(operatorAddress, holderAddress);
}

// ==================== LSP8 COLLECTION INFO ====================

/**
 * Get LSP8 collection information
 */
export async function getLSP8Info(
  collectionAddress: string,
  provider: Provider
): Promise<LSP8CollectionInfo> {
  const collection = new Contract(collectionAddress, LSP8_ABI, provider);

  // Verify it's LSP8
  const isLSP8 = await collection
    .supportsInterface(INTERFACE_IDS.LSP8IdentifiableDigitalAsset)
    .catch(() => false);
  if (!isLSP8) {
    throw new UniversalProfileError(
      `Address is not an LSP8 collection: ${collectionAddress}`,
      ERROR_CODES.INVALID_ADDRESS
    );
  }

  const [name, symbol, totalSupply, owner] = await Promise.all([
    collection.name(),
    collection.symbol(),
    collection.totalSupply(),
    collection.owner(),
  ]);

  // Try to get token ID format
  let tokenIdFormat = 0;
  try {
    const formatData = await collection.getData(
      '0x715f248956de7ce65e94d9d836bfead479f7e70d69b718d47bfe7b00e05b4fe4' // LSP8TokenIdFormat
    );
    if (formatData && formatData !== '0x') {
      tokenIdFormat = parseInt(formatData, 16);
    }
  } catch {
    // Default to number format
  }

  return {
    address: collectionAddress,
    name,
    symbol,
    totalSupply,
    owner,
    tokenIdFormat,
  };
}

/**
 * Get LSP8 tokens owned by an address
 */
export async function getLSP8TokensOf(
  collectionAddress: string,
  holderAddress: string,
  provider: Provider
): Promise<string[]> {
  const collection = new Contract(collectionAddress, LSP8_ABI, provider);
  return collection.tokenIdsOf(holderAddress);
}

/**
 * Get owner of a specific LSP8 token
 */
export async function getLSP8TokenOwner(
  collectionAddress: string,
  tokenId: string,
  provider: Provider
): Promise<string> {
  const collection = new Contract(collectionAddress, LSP8_ABI, provider);
  return collection.tokenOwnerOf(tokenId);
}

/**
 * Check if address is operator for LSP8 token
 */
export async function isLSP8Operator(
  collectionAddress: string,
  operatorAddress: string,
  tokenId: string,
  provider: Provider
): Promise<boolean> {
  const collection = new Contract(collectionAddress, LSP8_ABI, provider);
  return collection.isOperatorFor(operatorAddress, tokenId);
}

// ==================== TRANSFER ENCODING ====================

/**
 * Encode LSP7 transfer via UP execute
 */
export function encodeLSP7Transfer(
  tokenAddress: string,
  from: string,
  to: string,
  amount: bigint,
  force: boolean = true,
  data: string = '0x'
): ExecuteParams {
  const tokenInterface = new ethers.Interface(LSP7_ABI);
  const transferCalldata = tokenInterface.encodeFunctionData('transfer', [
    from,
    to,
    amount,
    force,
    data,
  ]);

  return {
    operationType: OPERATION_TYPES.CALL,
    target: tokenAddress,
    value: 0n,
    data: transferCalldata,
  };
}

/**
 * Encode LSP8 transfer via UP execute
 */
export function encodeLSP8Transfer(
  collectionAddress: string,
  from: string,
  to: string,
  tokenId: string,
  force: boolean = true,
  data: string = '0x'
): ExecuteParams {
  const collectionInterface = new ethers.Interface(LSP8_ABI);
  const transferCalldata = collectionInterface.encodeFunctionData('transfer', [
    from,
    to,
    tokenId,
    force,
    data,
  ]);

  return {
    operationType: OPERATION_TYPES.CALL,
    target: collectionAddress,
    value: 0n,
    data: transferCalldata,
  };
}

/**
 * Encode LSP7 operator authorization via UP execute
 */
export function encodeLSP7AuthorizeOperator(
  tokenAddress: string,
  operator: string,
  amount: bigint,
  operatorNotificationData: string = '0x'
): ExecuteParams {
  const tokenInterface = new ethers.Interface(LSP7_ABI);
  const authorizeCalldata = tokenInterface.encodeFunctionData(
    'authorizeOperator',
    [operator, amount, operatorNotificationData]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: tokenAddress,
    value: 0n,
    data: authorizeCalldata,
  };
}

/**
 * Encode LSP8 operator authorization via UP execute
 */
export function encodeLSP8AuthorizeOperator(
  collectionAddress: string,
  operator: string,
  tokenId: string,
  operatorNotificationData: string = '0x'
): ExecuteParams {
  const collectionInterface = new ethers.Interface(LSP8_ABI);
  const authorizeCalldata = collectionInterface.encodeFunctionData(
    'authorizeOperator',
    [operator, tokenId, operatorNotificationData]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: collectionAddress,
    value: 0n,
    data: authorizeCalldata,
  };
}

// ==================== MINTING ====================

/**
 * Encode LSP7 mint via UP execute
 */
export function encodeLSP7Mint(
  tokenAddress: string,
  to: string,
  amount: bigint,
  force: boolean = true,
  data: string = '0x'
): ExecuteParams {
  const tokenInterface = new ethers.Interface(LSP7_MINTABLE_ABI);
  const mintCalldata = tokenInterface.encodeFunctionData('mint', [
    to,
    amount,
    force,
    data,
  ]);

  return {
    operationType: OPERATION_TYPES.CALL,
    target: tokenAddress,
    value: 0n,
    data: mintCalldata,
  };
}

/**
 * Encode LSP8 mint via UP execute
 */
export function encodeLSP8Mint(
  collectionAddress: string,
  to: string,
  tokenId: string,
  force: boolean = true,
  data: string = '0x'
): ExecuteParams {
  const collectionInterface = new ethers.Interface(LSP8_MINTABLE_ABI);
  const mintCalldata = collectionInterface.encodeFunctionData('mint', [
    to,
    tokenId,
    force,
    data,
  ]);

  return {
    operationType: OPERATION_TYPES.CALL,
    target: collectionAddress,
    value: 0n,
    data: mintCalldata,
  };
}

// ==================== TOKEN ID HELPERS ====================

/**
 * Convert number to bytes32 token ID
 */
export function numberToTokenId(num: number | bigint): string {
  return ethers.zeroPadValue(ethers.toBeHex(num), 32);
}

/**
 * Convert string to bytes32 token ID
 */
export function stringToTokenId(str: string): string {
  const bytes = ethers.toUtf8Bytes(str);
  if (bytes.length > 32) {
    throw new Error('String too long for token ID');
  }
  return ethers.zeroPadBytes(bytes, 32);
}

/**
 * Convert address to bytes32 token ID
 */
export function addressToTokenId(address: string): string {
  if (!ethers.isAddress(address)) {
    throw new Error('Invalid address');
  }
  return ethers.zeroPadValue(address, 32);
}

/**
 * Convert bytes32 token ID to human-readable format based on format type
 */
export function formatTokenId(
  tokenId: string,
  format: number = LSP8_TOKEN_ID_FORMAT.NUMBER
): string {
  switch (format) {
    case LSP8_TOKEN_ID_FORMAT.NUMBER:
      return BigInt(tokenId).toString();
    case LSP8_TOKEN_ID_FORMAT.STRING:
      try {
        return ethers.toUtf8String(ethers.getBytes(tokenId)).replace(/\0+$/, '');
      } catch {
        return tokenId;
      }
    case LSP8_TOKEN_ID_FORMAT.ADDRESS:
      return ethers.getAddress('0x' + tokenId.slice(-40));
    default:
      return tokenId;
  }
}

// ==================== METADATA ====================

/**
 * Get token metadata (LSP4)
 */
export async function getTokenMetadata(
  tokenAddress: string,
  provider: Provider
): Promise<any> {
  const token = new Contract(
    tokenAddress,
    ['function getData(bytes32) view returns (bytes)'],
    provider
  );

  const metadataData = await token.getData(DATA_KEYS.LSP4Metadata);

  if (!metadataData || metadataData === '0x') {
    return null;
  }

  // Parse VerifiableURI format
  // This is simplified - real implementation would fetch from IPFS
  return metadataData;
}

/**
 * Get NFT-specific metadata (per tokenId)
 */
export async function getNFTTokenMetadata(
  collectionAddress: string,
  tokenId: string,
  provider: Provider
): Promise<any> {
  const collection = new Contract(
    collectionAddress,
    ['function getDataForTokenId(bytes32,bytes32) view returns (bytes)'],
    provider
  );

  try {
    const metadataData = await collection.getDataForTokenId(
      tokenId,
      DATA_KEYS.LSP4Metadata
    );

    if (!metadataData || metadataData === '0x') {
      return null;
    }

    return metadataData;
  } catch {
    return null;
  }
}
