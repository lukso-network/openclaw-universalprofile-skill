/**
 * Update Universal Profile LSP3 Metadata
 * 
 * This script uploads profile JSON to IPFS and updates the profile on-chain.
 * 
 * Usage:
 *   node update-profile.js <up-address> <private-key> <json-file>
 * 
 * Example:
 *   node update-profile.js 0x1234... 0xabc123... profile.json
 */

const { ethers } = require('ethers');
const https = require('https');
const fs = require('fs');
const FormData = require('form-data');

// Configuration
const LUKSO_MAINNET_RPC = 'https://42.rpc.thirdweb.com';
const LUKSO_TESTNET_RPC = 'https://rpc.testnet.lukso.network';
const LSP3_PROFILE_KEY = '0x5ef83ad9559053e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';

// Pinata API (update with your credentials)
const PINATA_API_KEY = process.env.PINATA_API_KEY || 'your-api-key';
const PINATA_SECRET = process.env.PINATA_SECRET || 'your-secret';

/**
 * Upload JSON to IPFS via Pinata
 */
async function uploadToIPFS(jsonData) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', JSON.stringify(jsonData), { 
      filename: 'profile.json', 
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
 * Build VerifiableURI in legacy format (the only one that works)
 */
function buildVerifiableURI(jsonContent, ipfsCid) {
  const hashFunction = '6f357c6a'; // keccak256(utf8)
  
  // Compute hash of EXACT content from IPFS
  const jsonHash = ethers.keccak256(ethers.toUtf8Bytes(jsonContent));
  
  // Build URL
  const url = `ipfs://${ipfsCid}`;
  const urlHex = ethers.hexlify(ethers.toUtf8Bytes(url)).slice(2);
  
  // Legacy format: hashFunction(4) + hash(32) + url
  const verifiableUri = '0x' + hashFunction + jsonHash.slice(2) + urlHex;
  
  return {
    verifiableUri,
    jsonHash,
    url,
    bytes: (verifiableUri.length - 2) / 2
  };
}

/**
 * Update profile on-chain
 */
async function updateProfile(upAddress, privateKey, jsonData) {
  const provider = new ethers.JsonRpcProvider(LUKSO_MAINNET_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('📤 Uploading JSON to IPFS...');
  const cid = await uploadToIPFS(jsonData);
  console.log('✅ IPFS CID:', cid);
  
  console.log('🔄 Fetching exact content from IPFS...');
  const exactJson = await fetchFromIPFS(cid);
  
  console.log('🔐 Building VerifiableURI (legacy format)...');
  const { verifiableUri, jsonHash, url, bytes } = buildVerifiableURI(exactJson, cid);
  
  console.log('   Hash:', jsonHash);
  console.log('   URL:', url);
  console.log('   Bytes:', bytes);
  
  // Verify hash matches
  const verifyHash = ethers.keccak256(ethers.toUtf8Bytes(exactJson));
  if (verifyHash !== jsonHash) {
    throw new Error('Hash verification failed!');
  }
  console.log('✅ Hash verified');
  
  console.log('📝 Sending transaction to update profile...');
  const up = new ethers.Contract(upAddress, [
    'function setData(bytes32 dataKey, bytes dataValue) external'
  ], wallet);
  
  const tx = await up.setData(LSP3_PROFILE_KEY, verifiableUri);
  console.log('   Tx hash:', tx.hash);
  
  const receipt = await tx.wait();
  console.log('✅ Profile updated!');
  console.log('   Block:', receipt.blockNumber);
  console.log('   Gas used:', receipt.gasUsed.toString());
  
  return { cid, txHash: tx.hash, block: receipt.blockNumber };
}

// CLI
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node update-profile.js <up-address> <private-key> <json-file>');
  console.log('');
  console.log('Environment variables:');
  console.log('  PINATA_API_KEY   - Your Pinata API key');
  console.log('  PINATA_SECRET    - Your Pinata secret');
  process.exit(1);
}

const [upAddress, privateKey, jsonFile] = args;

// Load JSON
let jsonData;
try {
  const jsonContent = fs.readFileSync(jsonFile, 'utf8');
  jsonData = JSON.parse(jsonContent);
} catch (e) {
  console.error('Error reading JSON file:', e.message);
  process.exit(1);
}

// Run
updateProfile(upAddress, privateKey, jsonData)
  .then(result => {
    console.log('\n🎉 Done!', result);
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
