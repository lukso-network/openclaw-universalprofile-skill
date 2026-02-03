/**
 * Universal Profile Skill - High-Level API
 */

import { ethers, Provider, JsonRpcProvider, Wallet } from 'ethers';
import {
  generateKeyPair,
  encryptKey,
  decryptKey,
  loadKeystore,
  saveKey,
  listStoredKeys,
  getWallet,
} from './lib/crypto.js';
import {
  PERMISSION_PRESETS,
  combinePermissions,
  decodePermissions,
  validatePermissions,
  getPresetConfig,
} from './lib/permissions.js';
import {
  deployUniversalProfile,
  computeDeploymentAddresses,
  verifyDeployment,
  generateSalt,
} from './lib/deployment.js';
import {
  executeViaRelay,
  setDataViaRelay,
  getNonce,
  checkRelayQuota,
} from './lib/relay.js';
import {
  getProfileInfo,
  getControllers,
  isController,
  getKeyManager,
  getData,
} from './lib/profile.js';
import {
  getLSP7Info,
  getLSP8Info,
  getLSP7Balance,
  getLSP8TokensOf,
  encodeLSP7Transfer,
  encodeLSP8Transfer,
  encodeLSP7AuthorizeOperator,
  encodeLSP8AuthorizeOperator,
  encodeLSP7Mint,
  encodeLSP8Mint,
} from './lib/tokens.js';
import {
  getSwapQuote,
  getQuoteWithSlippage,
  getPoolInfo,
  encodeSwapExactTokensForTokens,
  encodeSwapExactETHForTokens,
  encodeAddLiquidity,
  getDeadline,
} from './lib/dex.js';
import {
  getListing,
  getCollectionListings,
  getSellerListings,
  getCollectionFloorPrice,
  isNFTListed,
  encodeCreateListing,
  encodeBuyListing,
  encodeCancelListing,
  getListingOperations,
} from './lib/marketplace.js';
import {
  loadConfig,
  saveConfig,
  updateConfig,
  getNetworkConfig,
  getRpcUrl,
  getRelayerUrl,
  hasUPConfig,
  hasControllerKey,
  setUPConfig,
  setControllerKeyConfig,
  resolveTokenAddress,
} from './utils/config.js';
import { NETWORKS, OPERATION_TYPES } from './utils/constants.js';
import {
  SkillConfig,
  KeyPair,
  StoredKey,
  UniversalProfileInfo,
  DeploymentConfig,
  DeploymentResult,
  PermissionPreset,
  SwapQuote,
  ListingInfo,
  ExecuteParams,
  UniversalProfileError,
  ERROR_CODES,
} from './types/index.js';

/**
 * Universal Profile Skill Class
 * Provides high-level API for all UP operations
 */
export class UniversalProfileSkill {
  private config: SkillConfig;
  private provider: Provider;
  private wallet?: Wallet;

  constructor(options?: {
    network?: string;
    rpcUrl?: string;
    privateKey?: string;
  }) {
    this.config = loadConfig();

    // Set up provider
    const rpcUrl =
      options?.rpcUrl || getRpcUrl(options?.network || this.config.network);
    this.provider = new JsonRpcProvider(rpcUrl);

    // Set up wallet if private key provided
    if (options?.privateKey) {
      this.wallet = new Wallet(options.privateKey, this.provider);
    }
  }

  // ==================== CONFIGURATION ====================

  /**
   * Get current configuration
   */
  getConfig(): SkillConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<SkillConfig>): void {
    this.config = updateConfig(updates);
  }

  /**
   * Check if UP is configured
   */
  isConfigured(): boolean {
    return hasUPConfig() && hasControllerKey();
  }

  // ==================== KEY MANAGEMENT ====================

  /**
   * Generate a new key pair
   */
  generateKey(): KeyPair {
    return generateKeyPair();
  }

  /**
   * Store an encrypted key
   */
  storeKey(privateKey: string, label: string, password: string): string {
    const keystore = encryptKey(privateKey, password);
    const keyPath = saveKey(keystore, label);
    setControllerKeyConfig(keystore.address, label, keyPath);
    return keyPath;
  }

  /**
   * Load a stored key
   */
  loadKey(labelOrPath: string, password: string): Wallet {
    const keystore = loadKeystore(labelOrPath);
    const privateKey = decryptKey(keystore, password);
    this.wallet = new Wallet(privateKey, this.provider);
    return this.wallet;
  }

  /**
   * List all stored keys
   */
  listKeys(): StoredKey[] {
    return listStoredKeys();
  }

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Get profile information
   */
  async getProfileInfo(address?: string): Promise<UniversalProfileInfo> {
    const upAddress = address || this.config.universalProfile?.address;
    if (!upAddress) {
      throw new UniversalProfileError(
        'No Universal Profile address configured',
        ERROR_CODES.CONFIG_NOT_FOUND
      );
    }
    return getProfileInfo(upAddress, this.provider);
  }

  /**
   * Deploy a new Universal Profile
   */
  async deployProfile(options: {
    recoveryAddress?: string;
    fundingAmount?: bigint;
  } = {}): Promise<DeploymentResult> {
    this.ensureWallet();

    const config: DeploymentConfig = {
      salt: generateSalt(),
      fundingAmount: options.fundingAmount || 0n,
      controllerKey: this.wallet!.address,
      recoveryAddress: options.recoveryAddress,
      network: this.config.network,
    };

    const result = await deployUniversalProfile(this.wallet!, config);

    // Update config with new UP addresses
    setUPConfig(result.upAddress, result.keyManagerAddress);

    return result;
  }

  /**
   * Compute deployment addresses without deploying
   */
  async computeDeploymentAddresses(
    salt: string
  ): Promise<{ upAddress: string; keyManagerAddress: string }> {
    this.ensureWallet();

    const config: DeploymentConfig = {
      salt,
      fundingAmount: 0n,
      controllerKey: this.wallet!.address,
      network: this.config.network,
    };

    return computeDeploymentAddresses(config, this.provider);
  }

  // ==================== PERMISSIONS ====================

  /**
   * Get permission preset configuration
   */
  getPermissionPreset(preset: PermissionPreset) {
    return getPresetConfig(preset);
  }

  /**
   * Decode permissions from hex to names
   */
  decodePermissions(permissionHex: string): string[] {
    return decodePermissions(permissionHex);
  }

  /**
   * Validate permissions for risks
   */
  validatePermissions(permissionHex: string) {
    return validatePermissions(permissionHex);
  }

  /**
   * Generate authorization URL for user
   */
  getAuthorizationUrl(
    controllerAddress: string,
    preset: PermissionPreset = 'defi-trader'
  ): string {
    const baseUrl = this.config.ui.authorizationUrl;
    const presetConfig = getPresetConfig(preset);

    const params = new URLSearchParams({
      controller: controllerAddress,
      permissions: presetConfig.permissions,
      preset,
      network: this.config.network,
    });

    if (this.config.universalProfile?.address) {
      params.set('up', this.config.universalProfile.address);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  // ==================== EXECUTION ====================

  /**
   * Execute an operation via the configured UP
   */
  async execute(params: ExecuteParams): Promise<string> {
    this.ensureWallet();
    this.ensureUPConfig();

    const result = await executeViaRelay(
      this.wallet!,
      this.config.universalProfile!.address,
      this.config.universalProfile!.keyManager,
      params,
      {
        relayerUrl: getRelayerUrl(this.config.network) || undefined,
        useDirect: !this.config.relay.enabled,
      }
    );

    return result.transactionHash;
  }

  /**
   * Execute multiple operations in batch
   */
  async executeBatch(operations: ExecuteParams[]): Promise<string> {
    // For now, execute sequentially
    // TODO: Implement proper batch execution
    const hashes: string[] = [];
    for (const op of operations) {
      const hash = await this.execute(op);
      hashes.push(hash);
    }
    return hashes[hashes.length - 1];
  }

  // ==================== TOKEN OPERATIONS ====================

  /**
   * Get LSP7 token info
   */
  async getTokenInfo(tokenAddress: string) {
    return getLSP7Info(tokenAddress, this.provider);
  }

  /**
   * Get LSP8 collection info
   */
  async getCollectionInfo(collectionAddress: string) {
    return getLSP8Info(collectionAddress, this.provider);
  }

  /**
   * Transfer LSP7 tokens
   */
  async transferToken(
    tokenAddress: string,
    to: string,
    amount: bigint
  ): Promise<string> {
    this.ensureUPConfig();

    const params = encodeLSP7Transfer(
      tokenAddress,
      this.config.universalProfile!.address,
      to,
      amount
    );

    return this.execute(params);
  }

  /**
   * Transfer LSP8 NFT
   */
  async transferNFT(
    collectionAddress: string,
    to: string,
    tokenId: string
  ): Promise<string> {
    this.ensureUPConfig();

    const params = encodeLSP8Transfer(
      collectionAddress,
      this.config.universalProfile!.address,
      to,
      tokenId
    );

    return this.execute(params);
  }

  // ==================== DEX OPERATIONS ====================

  /**
   * Get swap quote
   */
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippage?: number
  ): Promise<{ quote: SwapQuote; minAmountOut: bigint }> {
    const networkConfig = getNetworkConfig(this.config.network);

    if (!networkConfig.contracts.UNIVERSALSWAPS_ROUTER) {
      throw new UniversalProfileError(
        'DEX router not configured for this network',
        ERROR_CODES.CONFIG_NOT_FOUND
      );
    }

    return getQuoteWithSlippage(
      networkConfig.contracts.UNIVERSALSWAPS_ROUTER,
      networkConfig.contracts.UNIVERSALSWAPS_FACTORY!,
      resolveTokenAddress(tokenIn),
      resolveTokenAddress(tokenOut),
      amountIn,
      slippage || this.config.defaults.slippage,
      this.provider
    );
  }

  /**
   * Execute token swap
   */
  async swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippage?: number
  ): Promise<string> {
    const networkConfig = getNetworkConfig(this.config.network);
    const { minAmountOut, quote } = await this.getSwapQuote(
      tokenIn,
      tokenOut,
      amountIn,
      slippage
    );

    // Authorize router to spend tokens
    const authorizeParams = encodeLSP7AuthorizeOperator(
      resolveTokenAddress(tokenIn),
      networkConfig.contracts.UNIVERSALSWAPS_ROUTER!,
      amountIn
    );
    await this.execute(authorizeParams);

    // Execute swap
    const swapParams = encodeSwapExactTokensForTokens(
      networkConfig.contracts.UNIVERSALSWAPS_ROUTER!,
      {
        tokenIn: resolveTokenAddress(tokenIn),
        tokenOut: resolveTokenAddress(tokenOut),
        amountIn,
        amountOutMin: minAmountOut,
        deadline: getDeadline(this.config.defaults.transactionDeadline),
        path: quote.path,
      },
      this.config.universalProfile!.address
    );

    return this.execute(swapParams);
  }

  // ==================== MARKETPLACE OPERATIONS ====================

  /**
   * Get collection listings
   */
  async getMarketplaceListings(collectionAddress: string): Promise<ListingInfo[]> {
    const networkConfig = getNetworkConfig(this.config.network);

    if (!networkConfig.contracts.MARKETPLACE) {
      throw new UniversalProfileError(
        'Marketplace not configured for this network',
        ERROR_CODES.CONFIG_NOT_FOUND
      );
    }

    return getCollectionListings(
      networkConfig.contracts.MARKETPLACE,
      collectionAddress,
      this.provider
    );
  }

  /**
   * List NFT for sale
   */
  async listNFT(
    collectionAddress: string,
    tokenId: string,
    price: bigint,
    durationDays: number = 7
  ): Promise<string> {
    const networkConfig = getNetworkConfig(this.config.network);

    if (!networkConfig.contracts.MARKETPLACE) {
      throw new UniversalProfileError(
        'Marketplace not configured for this network',
        ERROR_CODES.CONFIG_NOT_FOUND
      );
    }

    const operations = getListingOperations(networkConfig.contracts.MARKETPLACE, {
      nftContract: collectionAddress,
      tokenId,
      price,
      duration: durationDays * 24 * 60 * 60,
    });

    return this.executeBatch(operations);
  }

  /**
   * Buy NFT from marketplace
   */
  async buyNFT(listingId: bigint): Promise<string> {
    const networkConfig = getNetworkConfig(this.config.network);

    if (!networkConfig.contracts.MARKETPLACE) {
      throw new UniversalProfileError(
        'Marketplace not configured for this network',
        ERROR_CODES.CONFIG_NOT_FOUND
      );
    }

    // Get listing to know the price
    const listing = await getListing(
      networkConfig.contracts.MARKETPLACE,
      listingId,
      this.provider
    );

    const buyParams = encodeBuyListing(
      networkConfig.contracts.MARKETPLACE,
      listingId,
      listing.price
    );

    return this.execute(buyParams);
  }

  // ==================== HELPERS ====================

  private ensureWallet(): void {
    if (!this.wallet) {
      throw new UniversalProfileError(
        'No wallet configured. Call loadKey() first.',
        ERROR_CODES.KEY_NOT_FOUND
      );
    }
  }

  private ensureUPConfig(): void {
    if (!this.config.universalProfile?.address) {
      throw new UniversalProfileError(
        'No Universal Profile configured',
        ERROR_CODES.CONFIG_NOT_FOUND
      );
    }
  }
}

/**
 * Create a new Universal Profile Skill instance
 */
export function createUniversalProfileSkill(options?: {
  network?: string;
  rpcUrl?: string;
  privateKey?: string;
}): UniversalProfileSkill {
  return new UniversalProfileSkill(options);
}
