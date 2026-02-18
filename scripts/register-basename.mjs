import { ethers } from 'ethers';
import fs from 'fs';

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const creds = JSON.parse(fs.readFileSync('/Users/emmet/.clawdbot/credentials/universal-profile-key.json', 'utf8'));
const PRIVATE_KEY = creds.controller.privateKey;
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Basenames contracts on Base Mainnet
const REGISTRAR = '0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5';
const L2_RESOLVER = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD';

const UP_ADDRESS = '0x1089E1c613Db8Cb91db72be4818632153E62557a';
const KEY_MANAGER = '0x22373650D7533D85657F61ba97fF0CDde9308b6c'; // owner() of UP on Base

const NAME = 'emmet';
const BASENAME = 'emmet.base.eth';
const DURATION = 31557600 * 5; // 5 years

// Namehash computation (pure JS, no viem needed)
function namehash(name) {
  let node = '0x' + '00'.repeat(32);
  if (!name) return node;
  const labels = name.split('.').reverse();
  for (const label of labels) {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(label));
    node = ethers.keccak256(ethers.concat([node, labelHash]));
  }
  return node;
}

// ABIs
const l2ResolverIface = new ethers.Interface([
  'function setAddr(bytes32 node, address a)',
  'function setName(bytes32 node, string newName)',
  'function setText(bytes32 node, string key, string value)',
]);

const registrarIface = new ethers.Interface([
  'function register((string name, address owner, uint256 duration, address resolver, bytes[] data, bool reverseRecord) request) payable',
  'function registerPrice(string name, uint256 duration) view returns (uint256)',
]);

const upIface = new ethers.Interface([
  'function execute(uint256 operationType, address target, uint256 value, bytes data) returns (bytes)',
]);

const kmABI = [
  'function execute(bytes data) payable returns (bytes)',
  'function lsp20VerifyCall(address,address,address,uint256,bytes) returns (bytes4)',
];

async function main() {
  console.log('=== Registering emmet.base.eth (5 years) ===');
  console.log('Controller:', wallet.address);
  console.log('UP:', UP_ADDRESS);
  console.log('KeyManager:', KEY_MANAGER);
  
  const upBalance = await provider.getBalance(UP_ADDRESS);
  const ctrlBalance = await provider.getBalance(wallet.address);
  console.log('UP balance:', ethers.formatEther(upBalance), 'ETH');
  console.log('Controller balance (gas):', ethers.formatEther(ctrlBalance), 'ETH');
  
  // Get price
  const registrar = new ethers.Contract(REGISTRAR, registrarIface, provider);
  const price = await registrar.registerPrice(NAME, DURATION);
  console.log('Registration price:', ethers.formatEther(price), 'ETH');
  
  // Add 5% buffer
  const value = price * 105n / 100n;
  console.log('Sending with buffer:', ethers.formatEther(value), 'ETH');
  
  // Build resolver data
  const node = namehash(BASENAME);
  console.log('Namehash:', node);
  
  const setAddrData = l2ResolverIface.encodeFunctionData('setAddr', [node, UP_ADDRESS]);
  const setNameData = l2ResolverIface.encodeFunctionData('setName', [node, BASENAME]);
  
  // Build register calldata
  const registerCalldata = registrarIface.encodeFunctionData('register', [{
    name: NAME,
    owner: UP_ADDRESS,
    duration: DURATION,
    resolver: L2_RESOLVER,
    data: [setAddrData, setNameData],
    reverseRecord: true,
  }]);
  
  // Wrap in UP.execute(CALL, registrar, value, calldata)
  const upExecuteCalldata = upIface.encodeFunctionData('execute', [
    0, // CALL
    REGISTRAR,
    value,
    registerCalldata,
  ]);
  
  // Call through KeyManager
  const km = new ethers.Contract(KEY_MANAGER, kmABI, wallet);
  
  console.log('\nSending via KeyManager.execute(UP.execute(...))...');
  const tx = await km.execute(upExecuteCalldata, { gasLimit: 600000 });
  
  console.log('TX hash:', tx.hash);
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('✅ Confirmed in block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  
  // Verify
  const registrar2 = new ethers.Contract(REGISTRAR, ['function available(string) view returns (bool)'], provider);
  const stillAvailable = await registrar2.available(NAME);
  console.log('\nemmet still available?', stillAvailable, '(should be false)');
  
  const remaining = await provider.getBalance(UP_ADDRESS);
  console.log('UP remaining balance:', ethers.formatEther(remaining), 'ETH');
  
  console.log('\n=== emmet.base.eth registered for 5 years! ===');
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
