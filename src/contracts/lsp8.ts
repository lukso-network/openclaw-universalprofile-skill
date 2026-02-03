/**
 * LSP8 - Identifiable Digital Asset (NFT) ABI
 */

export const LSP8_ABI = [
  // Token info
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',

  // Ownership
  'function balanceOf(address tokenOwner) view returns (uint256)',
  'function tokenOwnerOf(bytes32 tokenId) view returns (address)',
  'function tokenIdsOf(address tokenOwner) view returns (bytes32[])',

  // Transfer
  'function transfer(address from, address to, bytes32 tokenId, bool force, bytes data) external',
  'function transferBatch(address[] from, address[] to, bytes32[] tokenId, bool[] force, bytes[] data) external',

  // Operators (per-token approval)
  'function authorizeOperator(address operator, bytes32 tokenId, bytes operatorNotificationData) external',
  'function revokeOperator(address operator, bytes32 tokenId, bool notify, bytes operatorNotificationData) external',
  'function isOperatorFor(address operator, bytes32 tokenId) view returns (bool)',
  'function getOperatorsOf(bytes32 tokenId) view returns (address[])',

  // Token data
  'function getDataForTokenId(bytes32 tokenId, bytes32 dataKey) view returns (bytes)',
  'function getDataBatchForTokenIds(bytes32[] tokenIds, bytes32[] dataKeys) view returns (bytes[])',
  'function setDataForTokenId(bytes32 tokenId, bytes32 dataKey, bytes dataValue) external',
  'function setDataBatchForTokenIds(bytes32[] tokenIds, bytes32[] dataKeys, bytes[] dataValues) external',

  // Collection data (ERC725Y)
  'function getData(bytes32 dataKey) view returns (bytes)',
  'function getDataBatch(bytes32[] dataKeys) view returns (bytes[])',
  'function setData(bytes32 dataKey, bytes dataValue) payable',
  'function setDataBatch(bytes32[] dataKeys, bytes[] dataValues) payable',

  // Ownership
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',

  // Token ID format
  'function tokenIdsDataKey() view returns (bytes32)',

  // ERC165
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
] as const;

// Mintable extension
export const LSP8_MINTABLE_ABI = [
  ...LSP8_ABI,
  'function mint(address to, bytes32 tokenId, bool force, bytes data) external',
  'function burn(bytes32 tokenId, bytes data) external',
] as const;

// Enumerable extension
export const LSP8_ENUMERABLE_ABI = [
  ...LSP8_ABI,
  'function tokenAt(uint256 index) view returns (bytes32)',
] as const;

// Events
export const LSP8_EVENTS = [
  'event Transfer(address operator, address indexed from, address indexed to, bytes32 indexed tokenId, bool force, bytes data)',
  'event OperatorAuthorizationChanged(address indexed operator, bytes32 indexed tokenId, bytes operatorNotificationData)',
  'event OperatorRevoked(address indexed operator, bytes32 indexed tokenId, bool indexed notified, bytes operatorNotificationData)',
  'event TokenIdDataChanged(bytes32 indexed tokenId, bytes32 indexed dataKey, bytes dataValue)',
] as const;

// Token ID formats
export const LSP8_TOKEN_ID_FORMAT = {
  NUMBER: 0,
  STRING: 1,
  ADDRESS: 2,
  UNIQUE_ID: 3,
  HASH: 4,
} as const;
