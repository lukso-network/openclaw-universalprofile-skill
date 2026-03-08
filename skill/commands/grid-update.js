#!/usr/bin/env node
/**
 * Update Universal Profile LSP28 TheGrid Metadata
 * 
 * This script uploads grid layout JSON to IPFS and updates the profile on-chain.
 * Uses Pinata for IPFS pinning (requires API credentials).
 * 
 * Supports both gasless relay (LUKSO only) and direct execution (all chains).
 * 
 * Usage:
 *   node commands/grid-update.js --up <address> --key <private-key> --json <file.json> [--network <network>]
 * 
 * Example:
 *   node commands/grid-update.js --up 0x1234... --key 0xabc... --json grid.json --network mainnet
 */

import { ethers } from 'ethers';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { executeRelay } from '../lib/execute/relay.js';
import { executeDirect } from '../lib/execute/direct.js';
import { OPERATION_TYPES } from '../lib/constants.js';

// Configuration
const LSP28_GRID_KEY = '0x724141d9918ce69e6b8afcf53a91748466086ba2c74b94cab43c649ae2ac23ff';

// Pinata API credentials (loaded from credentials file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadPinataCredentials() {
  const credentialsPath = path.resolve(__dirname, '../../../../credentials/pinata.json');
  try {
    const data = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    return {
      apiKey: data.api_key,
      secret: data.secret
    };
  } catch (err) {
    throw new Error(
      'Failed to load Pinata credentials.\n' +
      `Expected file: ${credentialsPath}\n` +
      'Create it with:\n' +
      '{\n' +
      '  "api_key": "your-api-key",\n' +
      '  "secret": "your-secret"\n' +
      '}\n' +
      'Get keys at: https://app.pinata.cloud/developers'
    );
  }
}

const { apiKey: PINATA_API_KEY, secret: PINATA_SECRET } = loadPinataCredentials();

// UP ABI for setData
const UP_ABI = ['function setData(bytes32 dataKey, bytes dataValue) external'];

/**
 * Upload JSON to IPFS via Pinata
 * @param {Object} jsonData - Grid metadata JSON
 * @returns {Promise<string>} IPFS CID
 */
async function uploadToIPFS(jsonData) {
  if (!PINATA_API_KEY || !PINATA_SECRET) {
    throw new Error(
      'Pinata credentials not set.\n' +
      'Set PINATA_API_KEY and PINATA_SECRET environment variables.\n' +
      'Get keys at: https://app.pinata.cloud/developers'
    );
  }

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', JSON.stringify(jsonData), {
      filename: 'grid.json',
      contentType: 'application/json'
    });

    const options = {
      hostname: 'api.pinata.cloud',
      path: '/pinning/pinFileToIPFS',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.IpfsHash) {
            resolve(result.IpfsHash);
          } else {
            reject(new Error(`Pinata error: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

/**
 * Fetch content from IPFS gateway
 * @param {string} cid - IPFS CID
 * @param {string} gateway - IPFS gateway URL
 * @returns {Promise<string>} Content as string
 */
async function fetchFromIPFS(cid, gateway = 'https://gateway.pinata.cloud') {
  return new Promise((resolve, reject) => {
    https.get(`${gateway}/ipfs/${cid}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Build VerifiableURI in legacy format (compatible with LUKSO wallet)
 * 
 * Format: 0x + hashFunction (4 bytes) + keccak256hash (32 bytes) + url (UTF-8 hex)
 * Note: Does NOT include hashLength bytes (0020) - this is the legacy format
 * that actually works with LUKSO extension/mobile apps.
 * 
 * @param {string} jsonContent - Exact JSON content from IPFS
 * @param {string} ipfsCid - IPFS CID
 * @returns {Object} VerifiableURI components
 */
function buildVerifiableURI(jsonContent, ipfsCid) {
  const hashFunction = '6f357c6a'; // keccak256(utf8)
  
  // Compute hash of EXACT content from IPFS
  const jsonHash = ethers.keccak256(ethers.toUtf8Bytes(jsonContent));
  
  // Build URL
  const url = `ipfs://${ipfsCid}`;
  const urlHex = ethers.hexlify(ethers.toUtf8Bytes(url)).slice(2);
  
  // Legacy format: hashFunction(4) + hash(32) + url (NO hashLength bytes)
  const verifiableUri = '0x' + hashFunction + jsonHash.slice(2) + urlHex;
  
  return {
    verifiableUri,
    jsonHash,
    url,
    bytes: (verifiableUri.length - 2) / 2
  };
}

/**
 * Update grid on-chain with gasless relay fallback
 * @param {string} upAddress - Universal Profile address
 * @param {string} privateKey - Controller private key
 * @param {Object} jsonData - Grid metadata JSON
 * @param {string} network - Network name (mainnet, testnet, base, ethereum)
 * @returns {Promise<Object>} Transaction result
 */
async function updateGrid(upAddress, privateKey, jsonData, network = 'mainnet') {
  console.log('📤 Uploading JSON to IPFS...');
  const cid = await uploadToIPFS(jsonData);
  console.log(`✅ IPFS CID: ${cid}`);

  console.log('🔄 Fetching exact content from IPFS...');
  const exactJson = await fetchFromIPFS(cid);
  console.log('🔐 Building VerifiableURI (legacy format)...');
  
  const { verifiableUri, jsonHash, url, bytes } = buildVerifiableURI(exactJson, cid);
  console.log(`   Hash: ${jsonHash}`);
  console.log(`   URL: ${url}`);
  console.log(`   Bytes: ${bytes}`);

  // Verify hash matches
  const verifyHash = ethers.keccak256(ethers.toUtf8Bytes(exactJson));
  if (verifyHash !== jsonHash) {
    throw new Error('Hash verification failed!');
  }
  console.log('✅ Hash verified');

  // Encode setData calldata
  const iface = new ethers.Interface(UP_ABI);
  const setDataData = iface.encodeFunctionData('setData', [LSP28_GRID_KEY, verifiableUri]);

  console.log(`📝 Sending transaction (${network})...`);
  
  // Try gasless relay first (LUKSO only)
  let result;
  if (network === 'mainnet' || network === 'testnet') {
    try {
      console.log('⛽ Attempting gasless relay...');
      result = await executeRelay(setDataData, { 
        network,
        upAddress,
        controllerAddress: undefined,
        privateKey 
      });
      console.log('✅ Gasless relay succeeded!');
    } catch (relayError) {
      console.log('⚠️ Gasless relay failed:', relayError.message);
      console.log('🔄 Falling back to direct execution...');
      
      // Fallback to direct execution
      result = await executeDirect(
        OPERATION_TYPES.CALL,
        upAddress,
        0,
        setDataData,
        { network, privateKey }
      );
      console.log('✅ Direct execution succeeded!');
    }
  } else {
    // Non-LUKSO chains: use direct execution
    console.log('ℹ️ Using direct execution (gasless not available on this chain)');
    result = await executeDirect(
      OPERATION_TYPES.CALL,
      upAddress,
      0,
      setDataData,
      { network, privateKey }
    );
    console.log('✅ Direct execution succeeded!');
  }

  console.log(`   Tx hash: ${result.txHash}`);
  console.log(`   Explorer: ${result.explorerUrl}`);

  return {
    cid,
    txHash: result.txHash,
    explorerUrl: result.explorerUrl
  };
}

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      result[key] = args[i + 1];
      i++;
    }
  }
  return result;
}

// Main
const args = parseArgs(process.argv.slice(2));

if (!args.up || !args.key || !args.json) {
  console.log('Usage: node commands/grid-update.js --up <address> --key <private-key> --json <file.json> [--network <network>]');
  console.log('');
  console.log('Options:');
  console.log('  --up       Universal Profile address');
  console.log('  --key      Controller private key');
  console.log('  --json     Grid metadata JSON file');
  console.log('  --network  Network: mainnet, testnet, base, ethereum (default: mainnet)');
  console.log('');
  console.log('Environment variables:');
  console.log('  PINATA_API_KEY   Your Pinata API key');
  console.log('  PINATA_SECRET    Your Pinata secret');
  console.log('');
  console.log('Note: Gasless relay is available on LUKSO mainnet/testnet only.');
  console.log('      Other chains use direct execution (controller pays gas).');
  process.exit(1);
}

// Load JSON
let jsonData;
try {
  const jsonContent = fs.readFileSync(args.json, 'utf8');
  jsonData = JSON.parse(jsonContent);
} catch (e) {
  console.error(`Error reading JSON file: ${e.message}`);
  process.exit(1);
}

const network = args.network || 'mainnet';

// Run
updateGrid(args.up, args.key, jsonData, network)
  .then(result => {
    console.log('\n🎉 Done!', result);
  })
  .catch(e => {
    console.error(`Error: ${e.message}`);
    if (process.env.DEBUG) {
      console.error(e.stack);
    }
    process.exit(1);
  });
