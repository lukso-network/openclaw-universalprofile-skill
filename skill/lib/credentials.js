/**
 * Universal Profile Credentials Helper
 *
 * Credential storage (secret — private key lives here):
 *   ~/.openclaw/credentials/universal-profile-key.json
 *
 * Skill config (non-secret — UP address, chain prefs):
 *   ~/.openclaw/skills/universal-profile/config.json  (managed by config.js)
 *
 * Lookup order:
 *   1. UP_CREDENTIALS_PATH env var (full path override)
 *   2. ~/.openclaw/credentials/universal-profile-key.json (standard)
 *
 * Expected file format:
 *   {
 *     "universalProfile": { "address": "0x..." },
 *     "controller": {
 *       "address": "0x...",
 *       "privateKey": "0x..."
 *     }
 *   }
 *
 * File permissions: chmod 600  (enforced on write, warned on read)
 */

import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE || '';

/**
 * Canonical path for the credential file
 */
export function getCredentialPath() {
  return (
    process.env.UP_CREDENTIALS_PATH ||
    (HOME && path.join(HOME, '.openclaw', 'credentials', 'universal-profile-key.json'))
  );
}

/**
 * Find and load credentials
 * @returns {Object} Credentials object { universalProfile, controller }
 * @throws {Error} If no credentials found
 */
export function loadCredentials() {
  const credPath = getCredentialPath();

  if (!credPath) {
    throw new Error(
      'Cannot determine credentials path: HOME is not set.\n' +
      'Set UP_CREDENTIALS_PATH to the full path of your credentials file.'
    );
  }

  if (!fs.existsSync(credPath)) {
    throw new Error(
      `Universal Profile credentials not found at:\n  ${credPath}\n\n` +
      'To fix:\n' +
      '  1. Set UP_CREDENTIALS_PATH to your credentials file path, or\n' +
      `  2. Create ${credPath} with your UP address and controller private key.\n\n` +
      'See SKILL.md for the expected file format and setup instructions.'
    );
  }

  // Warn if permissions are too open (POSIX only)
  try {
    const stat = fs.statSync(credPath);
    const mode = stat.mode & 0o777;
    if (mode & 0o044) {
      console.warn(
        `⚠️  Warning: ${credPath} is readable by group/others (mode ${mode.toString(8)}).\n` +
        '   Run: chmod 600 ' + credPath
      );
    }
  } catch {
    // Non-POSIX (Windows) — skip permission check
  }

  let creds;
  try {
    creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse credentials file at ${credPath}: ${err.message}`);
  }

  return creds;
}

/**
 * Validate credentials structure
 * @param {Object} creds
 * @throws {Error} If credentials are invalid
 */
export function validateCredentials(creds) {
  if (!creds.universalProfile?.address) {
    throw new Error('Missing universalProfile.address in credentials file');
  }
  if (!creds.controller?.address) {
    throw new Error('Missing controller.address in credentials file');
  }
  if (!creds.controller?.privateKey) {
    throw new Error('Missing controller.privateKey in credentials file');
  }

  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!addressRegex.test(creds.universalProfile.address)) {
    throw new Error('Invalid universalProfile.address format (expected 0x + 40 hex chars)');
  }
  if (!addressRegex.test(creds.controller.address)) {
    throw new Error('Invalid controller.address format (expected 0x + 40 hex chars)');
  }

  const keyRegex = /^(0x)?[a-fA-F0-9]{64}$/;
  if (!keyRegex.test(creds.controller.privateKey)) {
    throw new Error('Invalid controller.privateKey format (expected 0x + 64 hex chars)');
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

/**
 * Save credentials to the standard path
 * Sets file permissions to 600 on POSIX systems.
 * @param {Object} creds
 */
export function saveCredentials(creds) {
  validateCredentials(creds);

  const credPath = getCredentialPath();
  if (!credPath) {
    throw new Error('Cannot determine credentials path: HOME is not set.');
  }

  const dir = path.dirname(credPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(credPath, JSON.stringify(creds, null, 2), { encoding: 'utf8', mode: 0o600 });
}
