/**
 * Universal Profile Credentials Helper
 * Handles credential loading from multiple possible locations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Possible credential locations (in priority order)
 */
const CREDENTIAL_PATHS = [
  // 1. Environment variable (highest priority)
  process.env.UP_CREDENTIALS_PATH,
  
  // 2. OpenClaw standard location
  path.join(process.env.HOME, '.openclaw', 'universal-profile', 'config.json'),
  
  // 3. Legacy clawdbot location
  path.join(process.env.HOME, '.clawdbot', 'universal-profile', 'config.json'),
  
  // 4. Local skill directory (for testing)
  path.join(__dirname, '..', 'credentials', 'config.json'),
];

const KEY_PATHS = [
  // Environment variable
  process.env.UP_KEY_PATH,
  
  // OpenClaw standard
  path.join(process.env.HOME, '.openclaw', 'credentials', 'universal-profile-key.json'),
  
  // Legacy clawdbot
  path.join(process.env.HOME, '.clawdbot', 'credentials', 'universal-profile-key.json'),
  
  // Local skill directory
  path.join(__dirname, '..', 'credentials', 'universal-profile-key.json'),
];

/**
 * Find and load credentials
 * @returns {Object} Credentials object with universalProfile and controller
 * @throws {Error} If no credentials found
 */
export function loadCredentials() {
  // Try config.json locations
  for (const credPath of CREDENTIAL_PATHS.filter(Boolean)) {
    if (fs.existsSync(credPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        
        // If controller.privateKey is in config, we're done
        if (config.controller?.privateKey) {
          return config;
        }
        
        // Otherwise, try to load key from separate file
        for (const keyPath of KEY_PATHS.filter(Boolean)) {
          if (fs.existsSync(keyPath)) {
            const keyData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            return {
              ...config,
              controller: {
                ...config.controller,
                ...keyData.controller,
              }
            };
          }
        }
        
        // Config found but no key
        throw new Error(`Found config at ${credPath} but no private key found`);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
  
  // Try key-only files (some setups might only have the key file)
  for (const keyPath of KEY_PATHS.filter(Boolean)) {
    if (fs.existsSync(keyPath)) {
      try {
        return JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
  
  // No credentials found anywhere
  throw new Error(
    'Universal Profile credentials not found!\n\n' +
    'Searched locations:\n' +
    CREDENTIAL_PATHS.filter(Boolean).map(p => `  - ${p}`).join('\n') +
    '\n\nTo fix:\n' +
    '  1. Set UP_CREDENTIALS_PATH environment variable, or\n' +
    '  2. Place credentials in ~/.openclaw/universal-profile/config.json, or\n' +
    '  3. Place credentials in ~/.openclaw/credentials/universal-profile-key.json\n\n' +
    'See SKILL.md for setup instructions.'
  );
}

/**
 * Get credential file path (for reference)
 * @returns {string|null} Path to credentials file, or null if not found
 */
export function getCredentialsPath() {
  for (const credPath of CREDENTIAL_PATHS.filter(Boolean)) {
    if (fs.existsSync(credPath)) return credPath;
  }
  for (const keyPath of KEY_PATHS.filter(Boolean)) {
    if (fs.existsSync(keyPath)) return keyPath;
  }
  return null;
}

/**
 * Validate credentials structure
 * @param {Object} creds - Credentials object
 * @throws {Error} If credentials are invalid
 */
export function validateCredentials(creds) {
  if (!creds.universalProfile?.address) {
    throw new Error('Missing universalProfile.address in credentials');
  }
  if (!creds.controller?.address) {
    throw new Error('Missing controller.address in credentials');
  }
  if (!creds.controller?.privateKey) {
    throw new Error('Missing controller.privateKey in credentials');
  }
  
  // Validate address format
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(creds.universalProfile.address)) {
    throw new Error('Invalid universalProfile.address format');
  }
  if (!addressRegex.test(creds.controller.address)) {
    throw new Error('Invalid controller.address format');
  }
  
  // Validate private key format (with or without 0x prefix)
  const keyRegex = /^(0x)?[a-fA-F0-9]{64}$/;
  if (!keyRegex.test(creds.controller.privateKey)) {
    throw new Error('Invalid controller.privateKey format');
  }
}

/**
 * Load and validate credentials (convenience function)
 * @returns {Object} Validated credentials
 */
export function loadAndValidateCredentials() {
  const creds = loadCredentials();
  validateCredentials(creds);
  return creds;
}
