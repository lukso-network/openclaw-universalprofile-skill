/**
 * LSP6 - Key Manager ABI
 */

export const LSP6_ABI = [
  // Execute functions
  'function execute(bytes calldata payload) payable returns (bytes)',
  'function executeBatch(uint256[] values, bytes[] payloads) payable returns (bytes[])',

  // Relay call functions (LSP25)
  'function executeRelayCall(bytes signature, uint256 nonce, uint256 validityTimestamps, bytes payload) payable returns (bytes)',
  'function executeRelayCallBatch(bytes[] signatures, uint256[] nonces, uint256[] validityTimestamps, uint256[] values, bytes[] payloads) payable returns (bytes[])',

  // Nonce management
  'function getNonce(address from, uint128 channelId) view returns (uint256)',

  // Target (linked UP)
  'function target() view returns (address)',

  // Signature verification
  'function isValidSignature(bytes32 dataHash, bytes signature) view returns (bytes4)',

  // ERC165
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
] as const;

// Full ABI with events
export const LSP6_FULL_ABI = [
  ...LSP6_ABI,
  // Events
  'event PermissionsVerified(address indexed signer, uint256 indexed value, bytes4 indexed selector)',
] as const;
