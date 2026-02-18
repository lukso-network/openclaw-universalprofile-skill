/**
 * Universal Profile Deployment via LSP23 Factory
 */

import { ethers, Contract, Wallet, Provider } from 'ethers';
import {
  LSP23_ABI,
  type PrimaryContractDeploymentInit,
  type SecondaryContractDeploymentInit,
} from '../contracts/lsp23.js';
import { LSP0_ABI } from '../contracts/lsp0.js';
import { LSP6_ABI } from '../contracts/lsp6.js';
import { NETWORKS, DATA_KEYS, PERMISSIONS } from '../utils/constants.js';
import {
  DeploymentConfig,
  DeploymentResult,
  UniversalProfileError,
  ERROR_CODES,
} from '../types/index.js';

// ==================== DEPLOYMENT PARAMETERS ====================

/**
 * Prepare deployment parameters for LSP23 factory
 */
export function prepareDeploymentParams(
  config: DeploymentConfig,
  networkConfig: typeof NETWORKS[string]
): {
  primaryContractDeploymentInit: PrimaryContractDeploymentInit;
  secondaryContractDeploymentInit: SecondaryContractDeploymentInit;
} {
  const { contracts } = networkConfig;

  // Generate salt from config
  const salt = ethers.keccak256(ethers.toUtf8Bytes(config.salt));

  // Primary contract (UP) initialization
  // UniversalProfileInit.initialize(address initialOwner)
  const upInitCalldata = new ethers.Interface([
    'function initialize(address initialOwner)',
  ]).encodeFunctionData('initialize', [ethers.ZeroAddress]); // Temporary, set by post-deployment

  const primaryContractDeploymentInit: PrimaryContractDeploymentInit = {
    salt,
    fundingAmount: config.fundingAmount,
    implementationContract: contracts.UP_IMPLEMENTATION,
    initializationCalldata: upInitCalldata,
  };

  // Secondary contract (Key Manager) initialization
  // LSP6KeyManagerInit.initialize(address target)
  // The target will be added automatically since addPrimaryContractAddress is true
  const secondaryContractDeploymentInit: SecondaryContractDeploymentInit = {
    fundingAmount: 0n,
    implementationContract: contracts.KEY_MANAGER_IMPLEMENTATION,
    initializationCalldata: '0xc4d66de8', // initialize(address) selector only
    addPrimaryContractAddress: true,
    extraInitializationParams: '0x',
  };

  return { primaryContractDeploymentInit, secondaryContractDeploymentInit };
}

/**
 * Prepare post-deployment data for setting up permissions
 */
export function preparePostDeploymentData(
  controllerAddress: string,
  recoveryAddress?: string
): string {
  const dataKeys: string[] = [];
  const dataValues: string[] = [];

  const controllersCount = recoveryAddress ? 2 : 1;

  // Set AddressPermissions[] array length
  dataKeys.push(DATA_KEYS['AddressPermissions[]'].length);
  dataValues.push(ethers.zeroPadValue(ethers.toBeHex(controllersCount), 16));

  // Add primary controller (Clawdbot) to array at index 0
  dataKeys.push(
    DATA_KEYS['AddressPermissions[]'].index +
      ethers.zeroPadValue('0x00', 16).slice(2)
  );
  dataValues.push(controllerAddress);

  // Set primary controller permissions (ALL_PERMISSIONS)
  dataKeys.push(
    DATA_KEYS['AddressPermissions:Permissions'] +
      controllerAddress.slice(2).toLowerCase()
  );
  dataValues.push(PERMISSIONS.ALL_PERMISSIONS);

  // Optionally add recovery controller
  if (recoveryAddress) {
    // Add to array at index 1
    dataKeys.push(
      DATA_KEYS['AddressPermissions[]'].index +
        ethers.zeroPadValue('0x01', 16).slice(2)
    );
    dataValues.push(recoveryAddress);

    // Recovery permissions: CHANGEOWNER + ADDCONTROLLER + EDITPERMISSIONS
    const recoveryPermissions = ethers.zeroPadValue(
      ethers.toBeHex(
        BigInt(PERMISSIONS.CHANGEOWNER) |
          BigInt(PERMISSIONS.ADDCONTROLLER) |
          BigInt(PERMISSIONS.EDITPERMISSIONS)
      ),
      32
    );

    dataKeys.push(
      DATA_KEYS['AddressPermissions:Permissions'] +
        recoveryAddress.slice(2).toLowerCase()
    );
    dataValues.push(recoveryPermissions);
  }

  // Encode post-deployment data
  // The post-deployment module expects: abi.encode(bytes32[] dataKeys, bytes[] dataValues)
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['bytes32[]', 'bytes[]'],
    [dataKeys, dataValues]
  );
}

// ==================== ADDRESS COMPUTATION ====================

/**
 * Compute the addresses that will be deployed before actually deploying
 */
export async function computeDeploymentAddresses(
  config: DeploymentConfig,
  provider: Provider
): Promise<{ upAddress: string; keyManagerAddress: string }> {
  const networkConfig = NETWORKS[config.network];
  if (!networkConfig) {
    throw new UniversalProfileError(
      `Unknown network: ${config.network}`,
      ERROR_CODES.NETWORK_ERROR
    );
  }

  const factory = new Contract(
    networkConfig.contracts.LSP23_LINKED_CONTRACTS_FACTORY,
    LSP23_ABI,
    provider
  );

  const { primaryContractDeploymentInit, secondaryContractDeploymentInit } =
    prepareDeploymentParams(config, networkConfig);

  const postDeploymentData = preparePostDeploymentData(
    config.controllerKey,
    config.recoveryAddress
  );

  const [upAddress, keyManagerAddress] = await factory.computeERC1167Addresses(
    primaryContractDeploymentInit,
    secondaryContractDeploymentInit,
    networkConfig.contracts.UP_POST_DEPLOYMENT_MODULE,
    postDeploymentData
  );

  return { upAddress, keyManagerAddress };
}

// ==================== DEPLOYMENT ====================

/**
 * Deploy Universal Profile via LSP23 Factory
 */
export async function deployUniversalProfile(
  signer: Wallet,
  config: DeploymentConfig
): Promise<DeploymentResult> {
  const networkConfig = NETWORKS[config.network];
  if (!networkConfig) {
    throw new UniversalProfileError(
      `Unknown network: ${config.network}`,
      ERROR_CODES.NETWORK_ERROR
    );
  }

  const factory = new Contract(
    networkConfig.contracts.LSP23_LINKED_CONTRACTS_FACTORY,
    LSP23_ABI,
    signer
  );

  const { primaryContractDeploymentInit, secondaryContractDeploymentInit } =
    prepareDeploymentParams(config, networkConfig);

  const postDeploymentData = preparePostDeploymentData(
    config.controllerKey,
    config.recoveryAddress
  );

  // Compute addresses first
  const [predictedUP, predictedKM] = await factory.computeERC1167Addresses(
    primaryContractDeploymentInit,
    secondaryContractDeploymentInit,
    networkConfig.contracts.UP_POST_DEPLOYMENT_MODULE,
    postDeploymentData
  );

  // Check if already deployed
  const existingCode = await signer.provider!.getCode(predictedUP);
  if (existingCode !== '0x') {
    throw new UniversalProfileError(
      'Universal Profile already deployed at this address',
      ERROR_CODES.DEPLOYMENT_FAILED,
      { address: predictedUP }
    );
  }

  // Deploy
  const tx = await factory.deployERC1167Proxies(
    primaryContractDeploymentInit,
    secondaryContractDeploymentInit,
    networkConfig.contracts.UP_POST_DEPLOYMENT_MODULE,
    postDeploymentData,
    { value: config.fundingAmount }
  );

  const receipt = await tx.wait();

  if (!receipt || receipt.status !== 1) {
    throw new UniversalProfileError(
      'Deployment transaction failed',
      ERROR_CODES.DEPLOYMENT_FAILED,
      { transactionHash: tx.hash }
    );
  }

  return {
    upAddress: predictedUP,
    keyManagerAddress: predictedKM,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

// ==================== VERIFICATION ====================

/**
 * Verify that a deployed UP has the correct configuration
 */
export async function verifyDeployment(
  upAddress: string,
  keyManagerAddress: string,
  expectedController: string,
  provider: Provider
): Promise<boolean> {
  // Check UP code
  const upCode = await provider.getCode(upAddress);
  if (upCode === '0x') {
    return false;
  }

  // Check Key Manager code
  const kmCode = await provider.getCode(keyManagerAddress);
  if (kmCode === '0x') {
    return false;
  }

  // Check UP owner is Key Manager
  const up = new Contract(upAddress, LSP0_ABI, provider);
  const owner = await up.owner();
  if (owner.toLowerCase() !== keyManagerAddress.toLowerCase()) {
    return false;
  }

  // Check Key Manager target is UP
  const km = new Contract(keyManagerAddress, LSP6_ABI, provider);
  const target: string = await km.getFunction('target')();
  if (target.toLowerCase() !== upAddress.toLowerCase()) {
    return false;
  }

  // Check controller has permissions
  const permissionKey =
    DATA_KEYS['AddressPermissions:Permissions'] +
    expectedController.slice(2).toLowerCase();
  const permissions = await up.getData(permissionKey);

  if (!permissions || permissions === '0x') {
    return false;
  }

  return true;
}

/**
 * Check if UP already exists at address (useful before deployment)
 */
export async function isDeployed(
  address: string,
  provider: Provider
): Promise<boolean> {
  const code = await provider.getCode(address);
  return code !== '0x';
}

/**
 * Generate a unique salt for deployment
 */
export function generateSalt(prefix?: string): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix || 'clawdbot'}-${timestamp}-${random}`;
}
