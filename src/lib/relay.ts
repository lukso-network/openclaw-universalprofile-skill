/**
 * Relay Service Integration - LSP25 Execute Relay Call
 */

import { ethers, Contract, Wallet, Provider } from 'ethers';
import { LSP6_ABI } from '../contracts/lsp6.js';
import { LSP0_ABI } from '../contracts/lsp0.js';
import { LSP25_VERSION } from '../utils/constants.js';
import {
  RelayCallParams,
  RelayCallResult,
  ExecuteParams,
  UniversalProfileError,
  ERROR_CODES,
} from '../types/index.js';

// ==================== SIGNATURE GENERATION ====================

/**
 * Generate LSP25 signature for relay call
 */
export async function signRelayCall(
  signer: Wallet,
  params: RelayCallParams,
  chainId: number
): Promise<string> {
  // LSP25 message format:
  // keccak256(abi.encodePacked(LSP25_VERSION, chainId, nonce, validityTimestamps, msgValue, payload))
  const message = ethers.solidityPacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [
      LSP25_VERSION,
      chainId,
      params.nonce,
      params.validityTimestamps,
      params.value || 0n,
      params.payload,
    ]
  );

  const hash = ethers.keccak256(message);

  // Sign the hash (EIP-191 personal sign)
  const signature = await signer.signMessage(ethers.getBytes(hash));

  return signature;
}

/**
 * Get current nonce for a controller from Key Manager
 */
export async function getNonce(
  keyManagerAddress: string,
  signerAddress: string,
  channelId: number = 0,
  provider: Provider
): Promise<bigint> {
  const keyManager = new Contract(keyManagerAddress, LSP6_ABI, provider);
  return keyManager.getNonce(signerAddress, channelId);
}

/**
 * Create validity timestamps for relay call
 * @param startOffset - Seconds from now when the signature becomes valid (0 = immediately)
 * @param duration - How long the signature is valid in seconds
 */
export function createValidityTimestamps(
  startOffset: number = 0,
  duration: number = 3600
): bigint {
  const now = Math.floor(Date.now() / 1000);
  const startTime = now + startOffset;
  const endTime = startTime + duration;

  // Pack start and end times into a single uint256
  // validityTimestamps = (startTime << 128) | endTime
  return (BigInt(startTime) << 128n) | BigInt(endTime);
}

// ==================== RELAY EXECUTION ====================

/**
 * Execute a relay call through the LUKSO relayer service
 */
export async function executeViaRelayer(
  relayerUrl: string,
  keyManagerAddress: string,
  signature: string,
  nonce: bigint,
  validityTimestamps: bigint,
  payload: string,
  value: bigint = 0n
): Promise<RelayCallResult> {
  try {
    const response = await fetch(`${relayerUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyManagerAddress,
        signature,
        nonce: nonce.toString(),
        validityTimestamps: validityTimestamps.toString(),
        payload,
        value: value.toString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new UniversalProfileError(
        `Relayer error: ${response.statusText}`,
        ERROR_CODES.RELAY_FAILED,
        { status: response.status, error: errorData }
      );
    }

    const result = await response.json() as { transactionHash: string; returnData?: string };

    return {
      transactionHash: result.transactionHash,
      success: true,
      returnData: result.returnData,
    };
  } catch (error) {
    if (error instanceof UniversalProfileError) {
      throw error;
    }

    throw new UniversalProfileError(
      `Failed to execute relay call: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.RELAY_FAILED,
      { originalError: error }
    );
  }
}

/**
 * Execute a relay call directly on-chain (useful when relayer is unavailable)
 */
export async function executeRelayCallDirect(
  keyManagerAddress: string,
  signature: string,
  nonce: bigint,
  validityTimestamps: bigint,
  payload: string,
  signer: Wallet,
  value: bigint = 0n
): Promise<RelayCallResult> {
  const keyManager = new Contract(keyManagerAddress, LSP6_ABI, signer);

  try {
    const tx = await keyManager.executeRelayCall(
      signature,
      nonce,
      validityTimestamps,
      payload,
      { value }
    );

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new UniversalProfileError(
        'Relay call transaction failed',
        ERROR_CODES.RELAY_FAILED,
        { transactionHash: tx.hash }
      );
    }

    return {
      transactionHash: receipt.hash,
      success: true,
    };
  } catch (error) {
    if (error instanceof UniversalProfileError) {
      throw error;
    }

    throw new UniversalProfileError(
      `Failed to execute relay call: ${error instanceof Error ? error.message : String(error)}`,
      ERROR_CODES.RELAY_FAILED,
      { originalError: error }
    );
  }
}

// ==================== PAYLOAD ENCODING ====================

/**
 * Encode a UP execute call as payload for relay
 */
export function encodeExecutePayload(params: ExecuteParams): string {
  const iface = new ethers.Interface(LSP0_ABI);
  return iface.encodeFunctionData('execute', [
    params.operationType,
    params.target,
    params.value,
    params.data,
  ]);
}

/**
 * Encode a UP executeBatch call as payload for relay
 */
export function encodeExecuteBatchPayload(
  operations: ExecuteParams[]
): string {
  const iface = new ethers.Interface(LSP0_ABI);
  return iface.encodeFunctionData('executeBatch', [
    operations.map((op) => op.operationType),
    operations.map((op) => op.target),
    operations.map((op) => op.value),
    operations.map((op) => op.data),
  ]);
}

/**
 * Encode a setData call as payload for relay
 */
export function encodeSetDataPayload(dataKey: string, dataValue: string): string {
  const iface = new ethers.Interface(LSP0_ABI);
  return iface.encodeFunctionData('setData', [dataKey, dataValue]);
}

/**
 * Encode a setDataBatch call as payload for relay
 */
export function encodeSetDataBatchPayload(
  dataKeys: string[],
  dataValues: string[]
): string {
  const iface = new ethers.Interface(LSP0_ABI);
  return iface.encodeFunctionData('setDataBatch', [dataKeys, dataValues]);
}

// ==================== RELAY QUOTA ====================

export interface RelayQuota {
  remaining: number;
  total: number;
  resetsAt: Date | null;
}

/**
 * Check relay quota for a Universal Profile
 */
export async function checkRelayQuota(
  relayerUrl: string,
  upAddress: string
): Promise<RelayQuota> {
  try {
    const response = await fetch(`${relayerUrl}/quota/${upAddress}`);

    if (!response.ok) {
      // Return unknown quota if endpoint doesn't exist
      return {
        remaining: -1,
        total: -1,
        resetsAt: null,
      };
    }

    const data = await response.json() as { remaining?: number; total?: number; resetsAt?: string };

    return {
      remaining: data.remaining || 0,
      total: data.total || 0,
      resetsAt: data.resetsAt ? new Date(data.resetsAt) : null,
    };
  } catch {
    // Return unknown quota on error
    return {
      remaining: -1,
      total: -1,
      resetsAt: null,
    };
  }
}

// ==================== HIGH-LEVEL RELAY FUNCTIONS ====================

/**
 * Execute a transaction via UP using relay call
 * Handles nonce management and signature generation
 */
export async function executeViaRelay(
  signer: Wallet,
  _upAddress: string,
  keyManagerAddress: string,
  params: ExecuteParams,
  options: {
    relayerUrl?: string;
    validityDuration?: number;
    useDirect?: boolean;
  } = {}
): Promise<RelayCallResult> {
  const provider = signer.provider!;
  const chainId = (await provider.getNetwork()).chainId;

  // Get nonce
  const nonce = await getNonce(keyManagerAddress, signer.address, 0, provider);

  // Create validity timestamps
  const validityTimestamps = createValidityTimestamps(
    0,
    options.validityDuration || 3600
  );

  // Encode payload
  const payload = encodeExecutePayload(params);

  // Sign
  const signature = await signRelayCall(
    signer,
    { keyManagerAddress, payload, nonce, validityTimestamps, value: params.value },
    Number(chainId)
  );

  // Execute
  if (options.useDirect || !options.relayerUrl) {
    return executeRelayCallDirect(
      keyManagerAddress,
      signature,
      nonce,
      validityTimestamps,
      payload,
      signer,
      params.value
    );
  }

  return executeViaRelayer(
    options.relayerUrl,
    keyManagerAddress,
    signature,
    nonce,
    validityTimestamps,
    payload,
    params.value
  );
}

/**
 * Execute setData via UP using relay call
 */
export async function setDataViaRelay(
  signer: Wallet,
  _upAddress: string,
  keyManagerAddress: string,
  dataKey: string,
  dataValue: string,
  options: {
    relayerUrl?: string;
    validityDuration?: number;
    useDirect?: boolean;
  } = {}
): Promise<RelayCallResult> {
  const provider = signer.provider!;
  const chainId = (await provider.getNetwork()).chainId;

  const nonce = await getNonce(keyManagerAddress, signer.address, 0, provider);
  const validityTimestamps = createValidityTimestamps(0, options.validityDuration || 3600);
  const payload = encodeSetDataPayload(dataKey, dataValue);

  const signature = await signRelayCall(
    signer,
    { keyManagerAddress, payload, nonce, validityTimestamps },
    Number(chainId)
  );

  if (options.useDirect || !options.relayerUrl) {
    return executeRelayCallDirect(
      keyManagerAddress,
      signature,
      nonce,
      validityTimestamps,
      payload,
      signer
    );
  }

  return executeViaRelayer(
    options.relayerUrl,
    keyManagerAddress,
    signature,
    nonce,
    validityTimestamps,
    payload
  );
}
