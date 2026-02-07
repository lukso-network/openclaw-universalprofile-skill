/**
 * LSP-25 ExecuteRelayCall Implementation
 * 
 * CORRECT signature format according to LSP-25:
 * https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-25-ExecuteRelayCall.md
 * 
 * The signature MUST be constructed as:
 * 1. Create message: abi.encodePacked(LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload)
 * 2. Hash with EIP-191 v0: keccak256(0x19 || 0x00 || keyManagerAddress || message)
 * 3. Sign the raw hash (NOT using signMessage which adds Ethereum Signed Message prefix!)
 * 
 * WHAT WAS WRONG IN ORIGINAL CODE:
 * 1. Used signMessage() which adds EIP-191 v45 prefix ("Ethereum Signed Message")
 *    WRONG: controller.signMessage(ethers.getBytes(messageHash))
 *    CORRECT: signingKey.sign(hash) - raw hash signing
 * 
 * 2. Missing Key Manager address in hash (EIP-191 v0 "intended validator")
 *    WRONG: keccak256(abi.encodePacked(version, chainId, nonce, ...))
 *    CORRECT: keccak256(0x19 + 0x00 + keyManagerAddress + abi.encodePacked(...))
 * 
 * 3. Request "address" field was Key Manager instead of UP
 *    WRONG: address: keyManagerAddress
 *    CORRECT: address: upAddress (Universal Profile address)
 */

import { ethers } from 'ethers';
import fs from 'fs';

// Constants
const LSP25_VERSION = 25;
const LUKSO_CHAIN_ID = 42;

// LUKSO Relayer URLs
// Mainnet: https://relayer.lukso.network/v1/relayer/execute
// Testnet: https://relayer.testnet.lukso.network/v1/relayer/execute
const RELAYER_URL_MAINNET = 'https://relayer.lukso.network/v1/relayer/execute';
const RELAYER_URL_TESTNET = 'https://relayer.testnet.lukso.network/v1/relayer/execute';

// Load credentials
const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

// Connect to LUKSO
const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

// ABIs
const UP_ABI = [
  'function owner() view returns (address)',
  'function setData(bytes32 dataKey, bytes memory dataValue)',
  'function setData(bytes32[] memory dataKeys, bytes[] memory dataValues)',
  'function execute(uint256 operationType, address target, uint256 value, bytes memory data) payable returns (bytes)',
];

const KM_ABI = [
  'function getNonce(address signer, uint128 channel) view returns (uint256)',
  'function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)',
];

/**
 * Create EIP-191 version 0 hash (with intended validator)
 * Format: keccak256(0x19 || 0x00 || validatorAddress || data)
 * 
 * This is the "intended validator" variant of EIP-191 where:
 * - 0x19 = EIP-191 prefix byte
 * - 0x00 = version 0 (intended validator)
 * - validatorAddress = the contract that will validate this signature (Key Manager)
 * - data = the message data to sign
 */
function hashDataWithIntendedValidator(validatorAddress, data) {
  const prefix = new Uint8Array([0x19, 0x00]);
  const validatorBytes = ethers.getBytes(validatorAddress);
  const dataBytes = ethers.getBytes(data);
  
  const message = new Uint8Array(prefix.length + validatorBytes.length + dataBytes.length);
  message.set(prefix, 0);
  message.set(validatorBytes, prefix.length);
  message.set(dataBytes, prefix.length + validatorBytes.length);
  
  return ethers.keccak256(message);
}

/**
 * Create LSP-25 encoded message for signing
 * This matches what the contract does in _recoverSignerFromLSP25Signature
 */
function createLSP25Message(chainId, nonce, validityTimestamps, value, payload) {
  return ethers.solidityPacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
    [LSP25_VERSION, chainId, nonce, validityTimestamps, value, payload]
  );
}

/**
 * Sign data with EIP-191 version 0 format
 * 
 * CRITICAL: Use SigningKey.sign() NOT Wallet.signMessage()!
 * signMessage() adds an "Ethereum Signed Message" prefix which is WRONG for LSP-25
 * 
 * @param {string} keyManagerAddress - The Key Manager contract address (validator)
 * @param {string} encodedMessage - The packed message to sign
 * @param {string} privateKey - The signer's private key
 * @returns {string} The signature (65 bytes)
 */
function signLSP25Message(keyManagerAddress, encodedMessage, privateKey) {
  // Create EIP-191 v0 hash with Key Manager as intended validator
  const hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);
  
  // Sign the raw hash (NOT using signMessage!)
  const signingKey = new ethers.SigningKey(privateKey);
  const sig = signingKey.sign(hash);
  
  // Return serialized signature (65 bytes: r + s + v)
  return ethers.Signature.from(sig).serialized;
}

/**
 * Verify a signature locally (for testing)
 */
function verifyLSP25Signature(keyManagerAddress, encodedMessage, signature) {
  const hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);
  return ethers.recoverAddress(hash, signature);
}

/**
 * Execute a relay call via the LUKSO Transaction Relay Service
 * 
 * @param {string} payload - The ABI-encoded function call to execute on the UP
 * @param {Object} options - Options including value, validitySeconds, useTestnet
 * @returns {Promise<Object>} The relayer response with transactionHash
 */
async function executeRelayCall(payload, options = {}) {
  const { 
    value = 0, 
    validitySeconds = 0,  // 0 = indefinite validity
    useTestnet = false,
    verbose = true 
  } = options;
  
  if (verbose) {
    console.log('🔗 Universal Profile:', UP_ADDRESS);
    console.log('🔑 Controller:', CONTROLLER_ADDRESS);
  }
  
  // Get Key Manager address (owner of UP)
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const keyManagerAddress = await up.owner();
  if (verbose) console.log('🔐 Key Manager:', keyManagerAddress);
  
  // Get nonce for channel 0
  const km = new ethers.Contract(keyManagerAddress, KM_ABI, provider);
  const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
  if (verbose) console.log('🔢 Nonce:', nonce.toString());
  
  // Create validity timestamps
  // Format: uint256 where left 128 bits = start, right 128 bits = end
  // 0 = valid indefinitely (no time check)
  let validityTimestamps = 0n;
  if (validitySeconds > 0) {
    const now = Math.floor(Date.now() / 1000);
    validityTimestamps = (BigInt(now) << 128n) | BigInt(now + validitySeconds);
  }
  if (verbose) console.log('⏰ Validity:', validityTimestamps === 0n ? 'indefinite' : `${validitySeconds}s`);
  
  // Create the LSP25 encoded message
  const encodedMessage = createLSP25Message(
    LUKSO_CHAIN_ID,
    nonce,
    validityTimestamps,
    value,
    payload
  );
  
  // Sign with LSP25/EIP-191 v0 format
  const signature = signLSP25Message(keyManagerAddress, encodedMessage, PRIVATE_KEY);
  
  // Verify signature locally before sending
  const recoveredAddress = verifyLSP25Signature(keyManagerAddress, encodedMessage, signature);
  if (recoveredAddress.toLowerCase() !== CONTROLLER_ADDRESS.toLowerCase()) {
    throw new Error(`Signature verification failed! Expected ${CONTROLLER_ADDRESS}, got ${recoveredAddress}`);
  }
  if (verbose) console.log('✍️  Signature verified locally');
  
  // Prepare LSP-15 compliant relay request
  // validityTimestamps: hex string, properly zero-padded to 32 bytes for non-zero values
  const validityHex = validityTimestamps === 0n 
    ? '0x0' 
    : '0x' + validityTimestamps.toString(16).padStart(64, '0');
  
  const relayRequest = {
    address: UP_ADDRESS,  // ✅ UP address, NOT Key Manager
    transaction: {
      abi: payload,       // ✅ The payload to execute on UP
      signature: signature,
      nonce: Number(nonce),
      validityTimestamps: validityHex
    }
  };
  
  const relayerUrl = useTestnet ? RELAYER_URL_TESTNET : RELAYER_URL_MAINNET;
  if (verbose) {
    console.log('\n📤 Sending to relayer:', relayerUrl);
    console.log('Request:', JSON.stringify(relayRequest, null, 2));
  }
  
  const response = await fetch(relayerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(relayRequest)
  });
  
  const result = await response.json();
  if (verbose) {
    console.log('📊 Response:', response.status, response.statusText);
    console.log('📨 Body:', JSON.stringify(result, null, 2));
  }
  
  if (!response.ok) {
    throw new Error(`Relay error: ${response.status} - ${JSON.stringify(result)}`);
  }
  
  return result;
}

/**
 * Follow a Universal Profile by setting data
 */
async function followProfile(targetAddress) {
  console.log('\n🐙 Following Universal Profile:', targetAddress);
  console.log('================================================');
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  
  // Create a custom data key for "following"
  // Format: keccak256('LSP10Following:<address>')
  const followKey = ethers.keccak256(ethers.toUtf8Bytes('LSP10Following:' + targetAddress.toLowerCase()));
  const followValue = ethers.toUtf8Bytes('true');
  
  const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [followKey, followValue]);
  
  return executeRelayCall(payload);
}

/**
 * Set LSP3 Profile metadata
 */
async function setProfileMetadata(metadataUrl, metadataHash) {
  console.log('\n🐙 Setting Profile Metadata');
  console.log('================================================');
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  
  const LSP3_PROFILE_KEY = '0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5';
  
  // Create VerifiableURI format
  // Format: hashFunction (4 bytes) + hash (32 bytes) + url (bytes)
  const hashFunction = '0x6f357c6a'; // keccak256 hash function identifier
  const url = ethers.toUtf8Bytes(metadataUrl);
  const verifiableUri = ethers.concat([hashFunction, metadataHash, url]);
  
  const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [
    LSP3_PROFILE_KEY,
    verifiableUri
  ]);
  
  return executeRelayCall(payload);
}

// Export functions for use as a module
export {
  executeRelayCall,
  followProfile,
  setProfileMetadata,
  signLSP25Message,
  createLSP25Message,
  hashDataWithIntendedValidator,
  verifyLSP25Signature,
  UP_ADDRESS,
  CONTROLLER_ADDRESS,
  LSP25_VERSION,
  LUKSO_CHAIN_ID,
  RELAYER_URL_MAINNET,
  RELAYER_URL_TESTNET
};

// CLI execution
const args = process.argv.slice(2);
if (args[0] === 'follow' && args[1]) {
  followProfile(args[1])
    .then(result => {
      console.log('\n✅ Success!');
      console.log('Transaction hash:', result.transactionHash);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'test') {
  console.log('\n🧪 Testing LSP-25 Relay Call');
  console.log('================================================');
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const testKey = ethers.keccak256(ethers.toUtf8Bytes('EmmetTest:' + Date.now()));
  const testValue = ethers.toUtf8Bytes('test-value-' + Date.now());
  
  const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [testKey, testValue]);
  
  executeRelayCall(payload)
    .then(result => {
      console.log('\n✅ Success!');
      console.log('Transaction hash:', result.transactionHash);
    })
    .catch(err => {
      console.error('\n❌ Error:', err.message);
      process.exit(1);
    });
} else if (args[0] === 'verify') {
  // Just verify signature without sending to relayer
  console.log('\n🔍 Verifying LSP-25 Signature (no relay)');
  console.log('================================================');
  
  const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
  const keyManagerAddress = await up.owner();
  const km = new ethers.Contract(keyManagerAddress, KM_ABI, provider);
  const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
  
  const testKey = ethers.keccak256(ethers.toUtf8Bytes('EmmetTest:verify'));
  const testValue = ethers.toUtf8Bytes('test');
  const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [testKey, testValue]);
  
  const encodedMessage = createLSP25Message(LUKSO_CHAIN_ID, nonce, 0n, 0, payload);
  const signature = signLSP25Message(keyManagerAddress, encodedMessage, PRIVATE_KEY);
  const recoveredAddress = verifyLSP25Signature(keyManagerAddress, encodedMessage, signature);
  
  console.log('Controller:', CONTROLLER_ADDRESS);
  console.log('Key Manager:', keyManagerAddress);
  console.log('Nonce:', nonce.toString());
  console.log('Signature:', signature);
  console.log('Recovered:', recoveredAddress);
  console.log('Match:', recoveredAddress.toLowerCase() === CONTROLLER_ADDRESS.toLowerCase() ? '✅ YES' : '❌ NO');
} else {
  console.log('Usage:');
  console.log('  node lsp25-relay-call.js test     # Test with relayer');
  console.log('  node lsp25-relay-call.js verify   # Verify signature only');
  console.log('  node lsp25-relay-call.js follow <UP_ADDRESS>');
}
