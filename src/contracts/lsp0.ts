/**
 * LSP0 - Universal Profile (ERC725Account) ABI
 */

export const LSP0_ABI = [
  // Execute functions
  'function execute(uint256 operationType, address target, uint256 value, bytes data) payable returns (bytes)',
  'function executeBatch(uint256[] operationTypes, address[] targets, uint256[] values, bytes[] datas) payable returns (bytes[])',

  // Data functions (ERC725Y)
  'function getData(bytes32 dataKey) view returns (bytes)',
  'function getDataBatch(bytes32[] dataKeys) view returns (bytes[])',
  'function setData(bytes32 dataKey, bytes dataValue) payable',
  'function setDataBatch(bytes32[] dataKeys, bytes[] dataValues) payable',

  // Ownership (LSP14)
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',
  'function renounceOwnership()',

  // Universal Receiver (LSP1)
  'function universalReceiver(bytes32 typeId, bytes receivedData) payable returns (bytes)',

  // ERC165
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',

  // ERC1271
  'function isValidSignature(bytes32 dataHash, bytes signature) view returns (bytes4)',

  // Receive
  'receive() external payable',
] as const;

// Full ABI with events
export const LSP0_FULL_ABI = [
  ...LSP0_ABI,
  // Events
  'event DataChanged(bytes32 indexed dataKey, bytes dataValue)',
  'event Executed(uint256 indexed operationType, address indexed target, uint256 value, bytes4 indexed selector)',
  'event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
  'event OwnershipRenounced()',
  'event UniversalReceiver(address indexed from, uint256 indexed value, bytes32 indexed typeId, bytes receivedData, bytes returnedValue)',
] as const;
