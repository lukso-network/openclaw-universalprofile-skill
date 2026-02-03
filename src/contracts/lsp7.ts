/**
 * LSP7 - Digital Asset (Fungible Token) ABI
 */

export const LSP7_ABI = [
  // Token info
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',

  // Balance
  'function balanceOf(address tokenOwner) view returns (uint256)',

  // Transfer
  'function transfer(address from, address to, uint256 amount, bool force, bytes data) external',
  'function transferBatch(address[] from, address[] to, uint256[] amount, bool[] force, bytes[] data) external',

  // Operators (allowance equivalent)
  'function authorizeOperator(address operator, uint256 amount, bytes operatorNotificationData) external',
  'function revokeOperator(address operator, address tokenOwner, bool notify, bytes operatorNotificationData) external',
  'function authorizedAmountFor(address operator, address tokenOwner) view returns (uint256)',
  'function getOperatorsOf(address tokenOwner) view returns (address[])',

  // Data (ERC725Y)
  'function getData(bytes32 dataKey) view returns (bytes)',
  'function getDataBatch(bytes32[] dataKeys) view returns (bytes[])',
  'function setData(bytes32 dataKey, bytes dataValue) payable',
  'function setDataBatch(bytes32[] dataKeys, bytes[] dataValues) payable',

  // Ownership
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',

  // ERC165
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
] as const;

// Mintable extension
export const LSP7_MINTABLE_ABI = [
  ...LSP7_ABI,
  'function mint(address to, uint256 amount, bool force, bytes data) external',
  'function burn(address from, uint256 amount, bytes data) external',
] as const;

// Events
export const LSP7_EVENTS = [
  'event Transfer(address indexed operator, address indexed from, address indexed to, uint256 amount, bool force, bytes data)',
  'event OperatorAuthorizationChanged(address indexed operator, address indexed tokenOwner, uint256 indexed amount, bytes operatorNotificationData)',
  'event OperatorRevoked(address indexed operator, address indexed tokenOwner, bool indexed notified, bytes operatorNotificationData)',
] as const;
