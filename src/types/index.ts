/**
 * Universal Profile Skill - Type Definitions
 */

import { ethers } from 'ethers';

// ==================== KEY MANAGEMENT ====================

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  address: string;
}

export interface EncryptedKeystore {
  address: string;
  label: string;
  encryptedKey: string;
  iv: string;
  salt: string;
  algorithm: string;
  createdAt: string;
}

export interface StoredKey {
  address: string;
  label: string;
  path: string;
  createdAt: string;
  isAuthorized?: boolean;
}

// ==================== PROFILE ====================

export interface UniversalProfileInfo {
  address: string;
  name?: string;
  description?: string;
  keyManager: string;
  owner: string;
  balance: bigint;
  controllers: ControllerInfo[];
  receivedAssets: {
    lsp7: string[];
    lsp8: string[];
  };
}

export interface ControllerInfo {
  address: string;
  permissions: string;
  decodedPermissions: string[];
  allowedCalls?: string;
  allowedDataKeys?: string;
}

// ==================== DEPLOYMENT ====================

export interface DeploymentConfig {
  salt: string;
  fundingAmount: bigint;
  controllerKey: string;
  recoveryAddress?: string;
  network: string;
}

export interface DeploymentResult {
  upAddress: string;
  keyManagerAddress: string;
  transactionHash: string;
  blockNumber: number;
}

// ==================== PERMISSIONS ====================

export type PermissionPreset =
  | 'read-only'
  | 'token-operator'
  | 'nft-trader'
  | 'defi-trader'
  | 'profile-manager'
  | 'full-access';

export interface PermissionPresetConfig {
  name: string;
  description: string;
  permissions: string;
  allowedCalls?: AllowedCallsConfig;
  allowedDataKeys?: string[];
  riskLevel: 'low' | 'medium' | 'medium-high' | 'high' | 'critical';
}

export interface AllowedCallsConfig {
  callTypes: number[];
  addresses: string[];
  interfaceIds: string[];
  functionSelectors: string[];
}

export interface PermissionValidation {
  valid: boolean;
  warnings: string[];
  risks: string[];
}

// ==================== AUTHORIZATION ====================

export interface AuthorizationParams {
  controllerAddress: string;
  upAddress?: string;
  chainId: number;
  permissions: string;
  allowedCalls?: string;
  allowedDataKeys?: string;
}

export interface AuthorizationResult {
  transactionHash: string;
  controllerAddress: string;
  upAddress: string;
  permissions: string;
}

// ==================== RELAY ====================

export interface RelayCallParams {
  keyManagerAddress: string;
  payload: string;
  nonce: bigint;
  validityTimestamps: bigint;
  value?: bigint;
}

export interface RelayCallResult {
  transactionHash: string;
  success: boolean;
  returnData?: string;
  error?: string;
}

// ==================== TOKENS ====================

export interface LSP7TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  owner: string;
  isNonDivisible: boolean;
}

export interface LSP8CollectionInfo {
  address: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  owner: string;
  tokenIdFormat: number;
}

export interface TokenDeployParams {
  name: string;
  symbol: string;
  owner: string;
  lsp4TokenType?: number;
  initialSupply?: bigint;
  isNonDivisible?: boolean;
  mintable?: boolean;
  burnable?: boolean;
}

export interface NFTDeployParams {
  name: string;
  symbol: string;
  owner: string;
  lsp4TokenType?: number;
  tokenIdFormat?: number;
}

// ==================== MARKETPLACE ====================

export interface ListingParams {
  nftContract: string;
  tokenId: string;
  price: bigint;
  duration: number; // seconds
}

export interface ListingInfo {
  listingId: bigint;
  seller: string;
  nftContract: string;
  tokenId: string;
  price: bigint;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

export interface OfferParams {
  nftContract: string;
  tokenId: string;
  price: bigint;
  duration: number;
}

export interface OfferInfo {
  offerId: bigint;
  buyer: string;
  nftContract: string;
  tokenId: string;
  price: bigint;
  expiration: number;
}

// ==================== DEX ====================

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOutMin: bigint;
  deadline: number;
  path?: string[];
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  path: string[];
  executionPrice: number;
}

export interface LiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  deadline: number;
}

export interface PoolInfo {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

// ==================== CONFIGURATION ====================

export interface SkillConfig {
  version: string;
  network: string;
  rpc: Record<string, string>;
  universalProfile?: {
    address: string;
    keyManager: string;
  };
  controllerKey?: {
    address: string;
    label: string;
    encrypted: boolean;
    path: string;
  };
  contracts: Record<string, NetworkContracts>;
  defaults: {
    slippage: number;
    transactionDeadline: number;
    gasLimit: string | number;
    confirmations: number;
  };
  relay: {
    enabled: boolean;
    url: string;
    fallbackToDirect: boolean;
  };
  ui: {
    authorizationUrl: string;
  };
  tokens: {
    known: Record<string, string>;
  };
}

export interface NetworkContracts {
  lsp23Factory: string;
  marketplace?: string;
  router?: string;
  factory?: string;
  wlyx?: string;
}

// ==================== TRANSACTION ====================

export interface TransactionRequest {
  to: string;
  data: string;
  value?: bigint;
  gasLimit?: bigint;
}

export interface ExecuteParams {
  operationType: number;
  target: string;
  value: bigint;
  data: string;
}

// ==================== ERRORS ====================

export class UniversalProfileError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UniversalProfileError';
  }
}

export const ERROR_CODES = {
  KEY_NOT_FOUND: 'UP_KEY_NOT_FOUND',
  KEY_DECRYPT_FAILED: 'UP_KEY_DECRYPT_FAILED',
  PERMISSION_DENIED: 'UP_PERMISSION_DENIED',
  DEPLOYMENT_FAILED: 'UP_DEPLOYMENT_FAILED',
  RELAY_FAILED: 'UP_RELAY_FAILED',
  INVALID_SIGNATURE: 'UP_INVALID_SIGNATURE',
  QUOTA_EXCEEDED: 'UP_QUOTA_EXCEEDED',
  NETWORK_ERROR: 'UP_NETWORK_ERROR',
  INVALID_ADDRESS: 'UP_INVALID_ADDRESS',
  INSUFFICIENT_BALANCE: 'UP_INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'UP_TRANSACTION_FAILED',
  CONFIG_NOT_FOUND: 'UP_CONFIG_NOT_FOUND',
  NOT_AUTHORIZED: 'UP_NOT_AUTHORIZED',
} as const;
