/**
 * Key Management - Generation, Encryption, Storage
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import {
  KeyPair,
  EncryptedKeystore,
  StoredKey,
  UniversalProfileError,
  ERROR_CODES,
} from '../types/index.js';

// ==================== KEY GENERATION ====================

/**
 * Generate a new random key pair
 */
export function generateKeyPair(): KeyPair {
  const privateKeyBytes = crypto.randomBytes(32);
  const privateKey = '0x' + privateKeyBytes.toString('hex');
  const wallet = new ethers.Wallet(privateKey);

  return {
    privateKey,
    publicKey: wallet.signingKey.publicKey,
    address: wallet.address,
  };
}

/**
 * Generate key pair from mnemonic with derivation path
 */
export function deriveKeyFromMnemonic(
  mnemonic: string,
  index: number = 0,
  basePath: string = "m/44'/60'/0'/0"
): KeyPair {
  const hdNode = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(mnemonic),
    `${basePath}/${index}`
  );

  return {
    privateKey: hdNode.privateKey,
    publicKey: hdNode.publicKey,
    address: hdNode.address,
  };
}

/**
 * Generate a new mnemonic phrase
 */
export function generateMnemonic(strength: number = 128): string {
  return Mnemonic.fromEntropy(crypto.randomBytes(strength / 8)).phrase;
}

// ==================== KEY ENCRYPTION ====================

const ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a private key with a password
 */
export function encryptKey(privateKey: string, password: string): EncryptedKeystore {
  // Derive encryption key from password
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');

  // Encrypt
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Get address from private key
  const wallet = new ethers.Wallet(privateKey);

  return {
    address: wallet.address,
    label: '',
    encryptedKey: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    algorithm: ALGORITHM,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypt an encrypted keystore
 */
export function decryptKey(keystore: EncryptedKeystore, password: string): string {
  try {
    // Derive decryption key
    const salt = Buffer.from(keystore.salt, 'hex');
    const key = crypto.pbkdf2Sync(password, salt, KEY_DERIVATION_ITERATIONS, 32, 'sha256');
    const iv = Buffer.from(keystore.iv, 'hex');

    // Extract encrypted data and auth tag
    const encryptedData = keystore.encryptedKey.slice(0, -AUTH_TAG_LENGTH * 2);
    const authTag = Buffer.from(
      keystore.encryptedKey.slice(-AUTH_TAG_LENGTH * 2),
      'hex'
    );

    // Decrypt
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new UniversalProfileError(
      'Failed to decrypt key - incorrect password or corrupted keystore',
      ERROR_CODES.KEY_DECRYPT_FAILED,
      { originalError: error instanceof Error ? error.message : String(error) }
    );
  }
}

// ==================== KEY STORAGE ====================

/**
 * Get default keystore directory
 */
export function getKeystoreDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~';
  return path.join(home, '.clawdbot', 'universal-profile', 'keys');
}

/**
 * Ensure keystore directory exists
 */
export function ensureKeystoreDir(): string {
  const dir = getKeystoreDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save encrypted key to file
 */
export function saveKey(
  keystore: EncryptedKeystore,
  label: string,
  directory?: string
): string {
  const dir = directory || ensureKeystoreDir();
  const filename = `${label}.enc`;
  const filepath = path.join(dir, filename);

  keystore.label = label;

  fs.writeFileSync(filepath, JSON.stringify(keystore, null, 2), 'utf8');

  return filepath;
}

/**
 * Load encrypted key from file
 */
export function loadKeystore(labelOrPath: string): EncryptedKeystore {
  let filepath: string;

  if (path.isAbsolute(labelOrPath) || labelOrPath.includes('/')) {
    filepath = labelOrPath;
  } else {
    filepath = path.join(getKeystoreDir(), `${labelOrPath}.enc`);
  }

  if (!fs.existsSync(filepath)) {
    throw new UniversalProfileError(
      `Key not found: ${labelOrPath}`,
      ERROR_CODES.KEY_NOT_FOUND,
      { path: filepath }
    );
  }

  const content = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(content) as EncryptedKeystore;
}

/**
 * List all stored keys
 */
export function listStoredKeys(): StoredKey[] {
  const dir = getKeystoreDir();

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.enc'));

  return files.map((file) => {
    const filepath = path.join(dir, file);
    const content = fs.readFileSync(filepath, 'utf8');
    const keystore = JSON.parse(content) as EncryptedKeystore;

    return {
      address: keystore.address,
      label: keystore.label || file.replace('.enc', ''),
      path: filepath,
      createdAt: keystore.createdAt,
    };
  });
}

/**
 * Delete a stored key
 */
export function deleteKey(labelOrPath: string): boolean {
  let filepath: string;

  if (path.isAbsolute(labelOrPath) || labelOrPath.includes('/')) {
    filepath = labelOrPath;
  } else {
    filepath = path.join(getKeystoreDir(), `${labelOrPath}.enc`);
  }

  if (!fs.existsSync(filepath)) {
    return false;
  }

  fs.unlinkSync(filepath);
  return true;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get wallet from private key
 */
export function getWallet(privateKey: string, provider?: ethers.Provider): ethers.Wallet {
  const wallet = new ethers.Wallet(privateKey);
  return provider ? wallet.connect(provider) : wallet;
}

/**
 * Validate private key format
 */
export function isValidPrivateKey(key: string): boolean {
  try {
    new ethers.Wallet(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate address format
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}
