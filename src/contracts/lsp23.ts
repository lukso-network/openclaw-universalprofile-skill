/**
 * LSP23 - Linked Contracts Factory ABI
 */

export const LSP23_ABI = [
  // Deploy ERC1167 Proxies (main deployment function)
  'function deployERC1167Proxies(tuple(bytes32 salt, uint256 fundingAmount, address implementationContract, bytes initializationCalldata) primaryContractDeploymentInit, tuple(uint256 fundingAmount, address implementationContract, bytes initializationCalldata, bool addPrimaryContractAddress, bytes extraInitializationParams) secondaryContractDeploymentInit, address postDeploymentModule, bytes postDeploymentModuleCalldata) payable returns (address primaryContractAddress, address secondaryContractAddress)',

  // Compute addresses before deployment
  'function computeERC1167Addresses(tuple(bytes32 salt, uint256 fundingAmount, address implementationContract, bytes initializationCalldata) primaryContractDeploymentInit, tuple(uint256 fundingAmount, address implementationContract, bytes initializationCalldata, bool addPrimaryContractAddress, bytes extraInitializationParams) secondaryContractDeploymentInit, address postDeploymentModule, bytes postDeploymentModuleCalldata) view returns (address primaryContractAddress, address secondaryContractAddress)',

  // Deploy contracts (non-proxy)
  'function deployContracts(tuple(bytes32 salt, uint256 fundingAmount, bytes creationBytecode) primaryContractDeployment, tuple(uint256 fundingAmount, bytes creationBytecode, bool addPrimaryContractAddress, bytes extraConstructorParams) secondaryContractDeployment, address postDeploymentModule, bytes postDeploymentModuleCalldata) payable returns (address primaryContractAddress, address secondaryContractAddress)',

  // Compute non-proxy addresses
  'function computeAddresses(tuple(bytes32 salt, uint256 fundingAmount, bytes creationBytecode) primaryContractDeployment, tuple(uint256 fundingAmount, bytes creationBytecode, bool addPrimaryContractAddress, bytes extraConstructorParams) secondaryContractDeployment, address postDeploymentModule, bytes postDeploymentModuleCalldata) view returns (address primaryContractAddress, address secondaryContractAddress)',
] as const;

// Post-deployment module ABI
export const LSP23_POST_DEPLOYMENT_MODULE_ABI = [
  'function executePostDeployment(address primaryContract, address secondaryContract, bytes calldata calldataToPostDeploymentModule) external',
] as const;

// Type interfaces for deployment params
export interface PrimaryContractDeploymentInit {
  salt: string;
  fundingAmount: bigint;
  implementationContract: string;
  initializationCalldata: string;
}

export interface SecondaryContractDeploymentInit {
  fundingAmount: bigint;
  implementationContract: string;
  initializationCalldata: string;
  addPrimaryContractAddress: boolean;
  extraInitializationParams: string;
}
