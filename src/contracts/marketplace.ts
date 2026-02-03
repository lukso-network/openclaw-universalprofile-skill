/**
 * NFT Marketplace Contract ABI (Universal Page compatible)
 * Standard marketplace interface for LSP8 NFTs on LUKSO
 */

export const MARKETPLACE_ABI = [
  // ==================== Listing Management ====================
  
  // Create a new listing
  'function createListing(address nftContract, bytes32 tokenId, uint256 price, uint256 duration) external returns (uint256 listingId)',
  
  // Cancel an existing listing
  'function cancelListing(uint256 listingId) external',
  
  // Update listing price
  'function updateListingPrice(uint256 listingId, uint256 newPrice) external',
  
  // ==================== Buying ====================
  
  // Buy a listed NFT (pay with native token - LYX)
  'function buyListing(uint256 listingId) external payable',
  
  // Buy with a specific payment token (LSP7)
  'function buyListingWithToken(uint256 listingId, address paymentToken) external',
  
  // ==================== Offers ====================
  
  // Make an offer on an NFT
  'function makeOffer(address nftContract, bytes32 tokenId, uint256 price, uint256 duration) external payable returns (uint256 offerId)',
  
  // Accept an offer
  'function acceptOffer(uint256 offerId) external',
  
  // Cancel an offer
  'function cancelOffer(uint256 offerId) external',
  
  // ==================== View Functions ====================
  
  // Get listing details
  'function getListing(uint256 listingId) external view returns (tuple(address seller, address nftContract, bytes32 tokenId, uint256 price, uint256 startTime, uint256 endTime, bool isActive) listing)',
  
  // Get all listings for a collection
  'function getListingsByCollection(address nftContract) external view returns (uint256[] listingIds)',
  
  // Get listings by seller
  'function getListingsBySeller(address seller) external view returns (uint256[] listingIds)',
  
  // Get offer details
  'function getOffer(uint256 offerId) external view returns (tuple(address buyer, address nftContract, bytes32 tokenId, uint256 price, uint256 expiration) offer)',
  
  // Get offers for a specific NFT
  'function getOffersForToken(address nftContract, bytes32 tokenId) external view returns (uint256[] offerIds)',
  
  // Get offers by buyer
  'function getOffersByBuyer(address buyer) external view returns (uint256[] offerIds)',
  
  // ==================== Fee Management ====================
  
  // Get marketplace fee (basis points, e.g., 250 = 2.5%)
  'function marketplaceFee() external view returns (uint256)',
  
  // Get fee recipient
  'function feeRecipient() external view returns (address)',
  
  // ==================== Admin Functions ====================
  
  // Set marketplace fee (only owner)
  'function setMarketplaceFee(uint256 newFee) external',
  
  // Set fee recipient (only owner)
  'function setFeeRecipient(address newRecipient) external',
] as const;

// Events
export const MARKETPLACE_EVENTS = [
  'event ListingCreated(uint256 indexed listingId, address indexed seller, address indexed nftContract, bytes32 tokenId, uint256 price, uint256 endTime)',
  'event ListingCancelled(uint256 indexed listingId)',
  'event ListingPriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice)',
  'event ListingSold(uint256 indexed listingId, address indexed buyer, uint256 price)',
  'event OfferCreated(uint256 indexed offerId, address indexed buyer, address indexed nftContract, bytes32 tokenId, uint256 price, uint256 expiration)',
  'event OfferCancelled(uint256 indexed offerId)',
  'event OfferAccepted(uint256 indexed offerId, address indexed seller)',
] as const;

// Type interfaces
export interface MarketplaceListing {
  seller: string;
  nftContract: string;
  tokenId: string;
  price: bigint;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

export interface MarketplaceOffer {
  buyer: string;
  nftContract: string;
  tokenId: string;
  price: bigint;
  expiration: number;
}

// Fee constants
export const MARKETPLACE_FEE_DENOMINATOR = 10000n; // Basis points
export const DEFAULT_MARKETPLACE_FEE = 250n; // 2.5%
