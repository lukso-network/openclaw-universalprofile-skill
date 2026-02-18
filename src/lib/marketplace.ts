/**
 * NFT Marketplace Integration
 */

import { ethers, Contract, Provider } from 'ethers';
import { MARKETPLACE_ABI } from '../contracts/marketplace.js';
import { OPERATION_TYPES } from '../utils/constants.js';
import { encodeLSP8AuthorizeOperator } from './tokens.js';
import {
  ListingParams,
  ListingInfo,
  OfferParams,
  OfferInfo,
  ExecuteParams,
} from '../types/index.js';

// ==================== LISTING QUERIES ====================

/**
 * Get listing details
 */
export async function getListing(
  marketplaceAddress: string,
  listingId: bigint,
  provider: Provider
): Promise<ListingInfo> {
  const marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, provider);

  const listing = await marketplace.getListing(listingId);

  return {
    listingId,
    seller: listing.seller,
    nftContract: listing.nftContract,
    tokenId: listing.tokenId,
    price: listing.price,
    startTime: Number(listing.startTime),
    endTime: Number(listing.endTime),
    isActive: listing.isActive,
  };
}

/**
 * Get all listings for a collection
 */
export async function getCollectionListings(
  marketplaceAddress: string,
  nftContract: string,
  provider: Provider
): Promise<ListingInfo[]> {
  const marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, provider);

  const listingIds = await marketplace.getListingsByCollection(nftContract);
  const listings: ListingInfo[] = [];

  for (const id of listingIds) {
    try {
      const listing = await getListing(marketplaceAddress, id, provider);
      if (listing.isActive) {
        listings.push(listing);
      }
    } catch {
      // Skip invalid listings
    }
  }

  return listings;
}

/**
 * Get listings by seller
 */
export async function getSellerListings(
  marketplaceAddress: string,
  sellerAddress: string,
  provider: Provider
): Promise<ListingInfo[]> {
  const marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, provider);

  const listingIds = await marketplace.getListingsBySeller(sellerAddress);
  const listings: ListingInfo[] = [];

  for (const id of listingIds) {
    try {
      const listing = await getListing(marketplaceAddress, id, provider);
      listings.push(listing);
    } catch {
      // Skip invalid listings
    }
  }

  return listings;
}

/**
 * Get floor price for a collection
 */
export async function getCollectionFloorPrice(
  marketplaceAddress: string,
  nftContract: string,
  provider: Provider
): Promise<bigint | null> {
  const listings = await getCollectionListings(
    marketplaceAddress,
    nftContract,
    provider
  );

  if (listings.length === 0) {
    return null;
  }

  return listings.reduce(
    (min, listing) => (listing.price < min ? listing.price : min),
    listings[0].price
  );
}

/**
 * Check if an NFT is currently listed
 */
export async function isNFTListed(
  marketplaceAddress: string,
  nftContract: string,
  tokenId: string,
  provider: Provider
): Promise<{ listed: boolean; listingId?: bigint; price?: bigint }> {
  const listings = await getCollectionListings(
    marketplaceAddress,
    nftContract,
    provider
  );

  const listing = listings.find(
    (l) =>
      l.nftContract.toLowerCase() === nftContract.toLowerCase() &&
      l.tokenId === tokenId
  );

  if (listing) {
    return {
      listed: true,
      listingId: listing.listingId,
      price: listing.price,
    };
  }

  return { listed: false };
}

// ==================== OFFER QUERIES ====================

/**
 * Get offer details
 */
export async function getOffer(
  marketplaceAddress: string,
  offerId: bigint,
  provider: Provider
): Promise<OfferInfo> {
  const marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, provider);

  const offer = await marketplace.getOffer(offerId);

  return {
    offerId,
    buyer: offer.buyer,
    nftContract: offer.nftContract,
    tokenId: offer.tokenId,
    price: offer.price,
    expiration: Number(offer.expiration),
  };
}

/**
 * Get offers for a specific NFT
 */
export async function getOffersForNFT(
  marketplaceAddress: string,
  nftContract: string,
  tokenId: string,
  provider: Provider
): Promise<OfferInfo[]> {
  const marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, provider);

  try {
    const offerIds = await marketplace.getOffersForToken(nftContract, tokenId);
    const offers: OfferInfo[] = [];

    for (const id of offerIds) {
      try {
        const offer = await getOffer(marketplaceAddress, id, provider);
        // Only include non-expired offers
        if (offer.expiration > Math.floor(Date.now() / 1000)) {
          offers.push(offer);
        }
      } catch {
        // Skip invalid offers
      }
    }

    return offers;
  } catch {
    return [];
  }
}

// ==================== LISTING ENCODING ====================

/**
 * Encode create listing via UP execute
 */
export function encodeCreateListing(
  marketplaceAddress: string,
  params: ListingParams
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const createListingCalldata = marketplaceInterface.encodeFunctionData(
    'createListing',
    [params.nftContract, params.tokenId, params.price, params.duration]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: 0n,
    data: createListingCalldata,
  };
}

/**
 * Encode cancel listing via UP execute
 */
export function encodeCancelListing(
  marketplaceAddress: string,
  listingId: bigint
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const cancelCalldata = marketplaceInterface.encodeFunctionData(
    'cancelListing',
    [listingId]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: 0n,
    data: cancelCalldata,
  };
}

/**
 * Encode update listing price via UP execute
 */
export function encodeUpdateListingPrice(
  marketplaceAddress: string,
  listingId: bigint,
  newPrice: bigint
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const updateCalldata = marketplaceInterface.encodeFunctionData(
    'updateListingPrice',
    [listingId, newPrice]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: 0n,
    data: updateCalldata,
  };
}

/**
 * Encode buy listing via UP execute
 */
export function encodeBuyListing(
  marketplaceAddress: string,
  listingId: bigint,
  price: bigint
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const buyCalldata = marketplaceInterface.encodeFunctionData('buyListing', [
    listingId,
  ]);

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: price,
    data: buyCalldata,
  };
}

// ==================== OFFER ENCODING ====================

/**
 * Encode make offer via UP execute
 */
export function encodeMakeOffer(
  marketplaceAddress: string,
  params: OfferParams
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const makeOfferCalldata = marketplaceInterface.encodeFunctionData(
    'makeOffer',
    [params.nftContract, params.tokenId, params.price, params.duration]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: params.price, // Offer value is locked
    data: makeOfferCalldata,
  };
}

/**
 * Encode accept offer via UP execute
 */
export function encodeAcceptOffer(
  marketplaceAddress: string,
  offerId: bigint
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const acceptCalldata = marketplaceInterface.encodeFunctionData(
    'acceptOffer',
    [offerId]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: 0n,
    data: acceptCalldata,
  };
}

/**
 * Encode cancel offer via UP execute
 */
export function encodeCancelOffer(
  marketplaceAddress: string,
  offerId: bigint
): ExecuteParams {
  const marketplaceInterface = new ethers.Interface(MARKETPLACE_ABI);

  const cancelCalldata = marketplaceInterface.encodeFunctionData(
    'cancelOffer',
    [offerId]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: marketplaceAddress,
    value: 0n,
    data: cancelCalldata,
  };
}

// ==================== FEE QUERIES ====================

/**
 * Get marketplace fee (basis points)
 */
export async function getMarketplaceFee(
  marketplaceAddress: string,
  provider: Provider
): Promise<bigint> {
  const marketplace = new Contract(marketplaceAddress, MARKETPLACE_ABI, provider);
  return marketplace.marketplaceFee();
}

/**
 * Calculate total cost including fees
 */
export async function calculateTotalCost(
  marketplaceAddress: string,
  price: bigint,
  provider: Provider
): Promise<{ price: bigint; fee: bigint; total: bigint }> {
  const feeBps = await getMarketplaceFee(marketplaceAddress, provider);
  const fee = (price * feeBps) / 10000n;

  return {
    price,
    fee,
    total: price + fee,
  };
}

// ==================== WORKFLOW HELPERS ====================

/**
 * Get operations needed to list an NFT
 * Returns array of operations: [authorizeOperator, createListing]
 */
export function getListingOperations(
  marketplaceAddress: string,
  params: ListingParams
): ExecuteParams[] {
  // First authorize marketplace as operator
  const authorizeOp = encodeLSP8AuthorizeOperator(
    params.nftContract,
    marketplaceAddress,
    params.tokenId
  );

  // Then create listing
  const listingOp = encodeCreateListing(marketplaceAddress, params);

  return [authorizeOp, listingOp];
}

/**
 * Sort listings by price
 */
export function sortListingsByPrice(
  listings: ListingInfo[],
  ascending: boolean = true
): ListingInfo[] {
  return [...listings].sort((a, b) => {
    const diff = a.price - b.price;
    return ascending ? Number(diff) : Number(-diff);
  });
}

/**
 * Filter active listings
 */
export function filterActiveListings(listings: ListingInfo[]): ListingInfo[] {
  const now = Math.floor(Date.now() / 1000);
  return listings.filter(
    (l) => l.isActive && l.endTime > now && l.startTime <= now
  );
}
