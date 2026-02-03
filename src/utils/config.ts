/**
 * Configuration Management
 */

import * as fs from 'fs';
import * as path from 'path';
import { NETWORKS, DEFAULT_NETWORK, DEFAULTS } from './constants.js';
import { SkillConfig, UniversalProfileError, ERROR_CODES } from '../types/index.js';

// ==================== PATHS ====================

/**
 * Get home directory
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '~';
}

/**
 * Get skill config directory
 */
export function getConfigDir(): string {
  return (
    process.env.UP_CONFIG_PATH ||
    path.join(getHomeDir(), '.clawdbot', 'universal-profile')
  );
}

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Ensure config directory exists
 */
export function ensureConfigDir(): string {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ==================== CONFIG LOADING ====================

/**
 * Get default configuration
 */
export function getDefaultConfig(): SkillConfig {
  return {
    version: '1.0.0',
    network: DEFAULT_NETWORK,
    rpc: Object.fromEntries(
      Object.entries(NETWORKS).map(([name, config]) => [name, config.rpcUrl])
    ),
    universalProfile: undefined,
    controllerKey: undefined,
    contracts: Object.fromEntries(
      Object.entries(NETWORKS).map(([name, config]) => [
        name,
        {
          lsp23Factory: config.contracts.LSP23_LINKED_CONTRACTS_FACTORY,
          marketplace: config.contracts.MARKETPLACE || undefined,
          router: config.contracts.UNIVERSALSWAPS_ROUTER || undefined,
          factory: config.contracts.UNIVERSALSWAPS_FACTORY || undefined,
          wlyx: config.contracts.WLYX || undefined,
        },
      ])
    ),
    defaults: {
      slippage: DEFAULTS.slippage,
      transactionDeadline: DEFAULTS.transactionDeadline,
      gasLimit: 'auto',
      confirmations: DEFAULTS.confirmations,
    },
    relay: {
      enabled: true,
      url: NETWORKS[DEFAULT_NETWORK].relayerUrl || '',
      fallbackToDirect: true,
    },
    ui: {
      authorizationUrl: 'https://up-auth.clawdbot.dev',
    },
    tokens: {
      known: {},
    },
  };
}

/**
 * Load configuration
 */
export function loadConfig(): SkillConfig {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    // Return default config if no config file exists
    return getDefaultConfig();
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const loaded = JSON.parse(content) as Partial<SkillConfig>;

    // Merge with defaults to ensure all fields exist
    return {
      ...getDefaultConfig(),
      ...loaded,
    };
  } catch (error) {
    throw new UniversalProfileError(
      `Failed to load config: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.CONFIG_NOT_FOUND,
      { path: configPath }
    );
  }
}

/**
 * Save configuration
 */
export function saveConfig(config: SkillConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Update specific config values
 */
export function updateConfig(updates: Partial<SkillConfig>): SkillConfig {
  const current = loadConfig();
  const updated = {
    ...current,
    ...updates,
  };
  saveConfig(updated);
  return updated;
}

// ==================== CONFIG HELPERS ====================

/**
 * Get network configuration
 */
export function getNetworkConfig(networkName?: string) {
  const config = loadConfig();
  const network = networkName || config.network;

  if (!NETWORKS[network]) {
    throw new UniversalProfileError(
      `Unknown network: ${network}`,
      ERROR_CODES.NETWORK_ERROR
    );
  }

  return {
    ...NETWORKS[network],
    // Override with custom RPC if set
    rpcUrl: config.rpc[network] || NETWORKS[network].rpcUrl,
    // Override with custom contract addresses if set
    contracts: {
      ...NETWORKS[network].contracts,
      ...config.contracts[network],
    },
  };
}

/**
 * Get RPC URL for network
 */
export function getRpcUrl(networkName?: string): string {
  const config = loadConfig();
  const network = networkName || config.network;
  return config.rpc[network] || NETWORKS[network]?.rpcUrl || '';
}

/**
 * Get relayer URL for network
 */
export function getRelayerUrl(networkName?: string): string | null {
  const network = networkName || loadConfig().network;
  return NETWORKS[network]?.relayerUrl || null;
}

/**
 * Check if config has UP setup
 */
export function hasUPConfig(): boolean {
  const config = loadConfig();
  return !!(
    config.universalProfile?.address && config.universalProfile?.keyManager
  );
}

/**
 * Check if config has controller key
 */
export function hasControllerKey(): boolean {
  const config = loadConfig();
  return !!(config.controllerKey?.address && config.controllerKey?.path);
}

/**
 * Set UP addresses in config
 */
export function setUPConfig(upAddress: string, keyManagerAddress: string): void {
  updateConfig({
    universalProfile: {
      address: upAddress,
      keyManager: keyManagerAddress,
    },
  });
}

/**
 * Set controller key in config
 */
export function setControllerKeyConfig(
  address: string,
  label: string,
  keyPath: string
): void {
  updateConfig({
    controllerKey: {
      address,
      label,
      encrypted: true,
      path: keyPath,
    },
  });
}

/**
 * Add known token to config
 */
export function addKnownToken(symbol: string, address: string): void {
  const config = loadConfig();
  config.tokens.known[symbol.toUpperCase()] = address;
  saveConfig(config);
}

/**
 * Get known token address by symbol
 */
export function getKnownToken(symbol: string): string | undefined {
  const config = loadConfig();
  return config.tokens.known[symbol.toUpperCase()];
}

/**
 * Resolve token symbol or address to address
 */
export function resolveTokenAddress(symbolOrAddress: string): string {
  // If it's already an address, return it
  if (symbolOrAddress.startsWith('0x')) {
    return symbolOrAddress;
  }

  // Try to resolve from known tokens
  const known = getKnownToken(symbolOrAddress);
  if (known) {
    return known;
  }

  // Handle special case for native token
  if (symbolOrAddress.toUpperCase() === 'LYX') {
    // Return WLYX address for DEX operations
    const config = loadConfig();
    const wlyx = config.contracts[config.network]?.wlyx;
    if (wlyx) {
      return wlyx;
    }
  }

  throw new UniversalProfileError(
    `Unknown token: ${symbolOrAddress}`,
    ERROR_CODES.INVALID_ADDRESS
  );
}
