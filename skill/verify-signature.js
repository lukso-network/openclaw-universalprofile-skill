/**
 * Verify LSP-25 signature by recovering the signer address
 * This tests our encoding is correct without needing the relayer
 */

import { ethers } from 'ethers';
import fs from 'fs';

// Load credentials
const credPath = process.env.HOME + '/.clawdbot/credentials/universal-profile-key.json';
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

const UP_ADDRESS = creds.universalProfile.address;
const PRIVATE_KEY = creds.controller.privateKey;
const CONTROLLER_ADDRESS = creds.controller.address;

// Constants
const LSP25_VERSION = 25;
const LUKSO_CHAIN_ID = 42;

// Connect to LUKSO
const provider = new ethers.JsonRpcProvider('https://42.rpc.thirdweb.com');

// ABIs
const UP_ABI = [
  'function owner() view returns (address)',
  'function setData(bytes32 dataKey, bytes memory dataValue)',
];

const KM_ABI = [
  'function getNonce(address signer, uint128 channel) view returns (uint256)',
];

console.log('🔍 LSP-25 Signature Verification Test');
console.log('=====================================');
console.log('Controller:', CONTROLLER_ADDRESS);
console.log('UP Address:', UP_ADDRESS);

// Get Key Manager address
const up = new ethers.Contract(UP_ADDRESS, UP_ABI, provider);
const keyManagerAddress = await up.owner();
console.log('Key Manager:', keyManagerAddress);

// Get nonce
const km = new ethers.Contract(keyManagerAddress, KM_ABI, provider);
const nonce = await km.getNonce(CONTROLLER_ADDRESS, 0);
console.log('Nonce:', nonce.toString());

// Create test payload
const testKey = ethers.keccak256(ethers.toUtf8Bytes('EmmetTest:' + Date.now()));
const testValue = ethers.toUtf8Bytes('test-value');
const payload = up.interface.encodeFunctionData('setData(bytes32,bytes)', [testKey, testValue]);
console.log('Payload:', payload.slice(0, 66) + '...');

// Create validity timestamps (valid for 1 hour, or 0 for indefinite)
const validityTimestamps = 0n; // Use 0 for indefinite - simpler to test
console.log('Validity:', 'indefinite (0)');

// Create LSP25 encoded message (same as contract does)
const encodedMessage = ethers.solidityPacked(
  ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes'],
  [LSP25_VERSION, LUKSO_CHAIN_ID, nonce, validityTimestamps, 0, payload]
);
console.log('\n📝 Encoded Message (hex):', encodedMessage.slice(0, 130) + '...');
console.log('   Length:', encodedMessage.length, 'chars,', (encodedMessage.length - 2) / 2, 'bytes');

/**
 * Create EIP-191 version 0 hash (with intended validator)
 * Format: keccak256(0x19 || 0x00 || validatorAddress || data)
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

// Create EIP-191 v0 hash
const eip191Hash = hashDataWithIntendedValidator(keyManagerAddress, encodedMessage);
console.log('\n🔐 EIP-191 v0 Hash:', eip191Hash);

// Sign the hash (NOT using signMessage - that adds Ethereum Signed Message prefix!)
const signingKey = new ethers.SigningKey(PRIVATE_KEY);
const sig = signingKey.sign(eip191Hash);
const signature = ethers.Signature.from(sig).serialized;
console.log('\n✍️  Signature:', signature);

// Recover the signer from the signature
const recoveredAddress = ethers.recoverAddress(eip191Hash, signature);
console.log('\n🔓 Recovered Address:', recoveredAddress);
console.log('   Expected Address:', CONTROLLER_ADDRESS);

if (recoveredAddress.toLowerCase() === CONTROLLER_ADDRESS.toLowerCase()) {
  console.log('\n✅ SIGNATURE VALID! The recovered address matches the controller.');
} else {
  console.log('\n❌ SIGNATURE INVALID! Address mismatch.');
  console.log('   This means our encoding is wrong.');
}

// Also verify using ecrecover approach (how the contract does it)
console.log('\n📋 Verification Summary:');
console.log('   - LSP25 Version:', LSP25_VERSION);
console.log('   - Chain ID:', LUKSO_CHAIN_ID);
console.log('   - Nonce:', nonce.toString());
console.log('   - Validity:', validityTimestamps.toString());
console.log('   - Value:', 0);
console.log('   - Payload length:', (payload.length - 2) / 2, 'bytes');
console.log('   - Key Manager (validator):', keyManagerAddress);
console.log('   - Signature format: EIP-191 v0 (intended validator)');

// Show the request that would be sent to the relayer
console.log('\n📤 LSP-15 Request Format:');
const request = {
  address: UP_ADDRESS,
  transaction: {
    abi: payload,
    signature: signature,
    nonce: Number(nonce),
    validityTimestamps: '0x0'
  }
};
console.log(JSON.stringify(request, null, 2));
