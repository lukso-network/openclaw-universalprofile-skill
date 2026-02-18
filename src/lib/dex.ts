/**
 * DEX Integration - UniversalSwaps (Uniswap V2 Compatible)
 */

import { ethers, Contract, Provider } from 'ethers';
import {
  UNISWAP_V2_ROUTER_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
} from '../contracts/dex.js';
import { OPERATION_TYPES, DEFAULTS } from '../utils/constants.js';
import {
  SwapParams,
  SwapQuote,
  LiquidityParams,
  PoolInfo,
  ExecuteParams,
} from '../types/index.js';

// ==================== PRICE QUERIES ====================

/**
 * Get swap quote for exact input amount
 */
export async function getSwapQuote(
  routerAddress: string,
  factoryAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  provider: Provider
): Promise<SwapQuote> {
  const router = new Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, provider);
  const factory = new Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, provider);

  // Check for direct pair
  const directPair = await factory.getPair(tokenIn, tokenOut);
  const weth = await router.WETH();

  let path: string[];
  if (directPair !== ethers.ZeroAddress) {
    path = [tokenIn, tokenOut];
  } else {
    // Route through WLYX/WETH
    path = [tokenIn, weth, tokenOut];
  }

  // Get expected output amounts
  const amounts = await router.getAmountsOut(amountIn, path);
  const amountOut = amounts[amounts.length - 1];

  // Calculate price impact
  const priceImpact = await calculatePriceImpact(
    factory,
    path,
    amountIn,
    provider
  );

  // Calculate execution price
  const executionPrice =
    Number(amountOut) / Number(amountIn) || 0;

  return {
    amountIn,
    amountOut,
    priceImpact,
    path,
    executionPrice,
  };
}

/**
 * Calculate price impact for a swap
 */
async function calculatePriceImpact(
  factory: Contract,
  path: string[],
  amountIn: bigint,
  provider: Provider
): Promise<number> {
  try {
    // Get first pair
    const pairAddress = await factory.getPair(path[0], path[1]);
    if (pairAddress === ethers.ZeroAddress) return 0;

    const pair = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
    const reserves = await pair.getReserves();
    const token0 = await pair.token0();

    // Determine which reserve corresponds to input token
    const reserveIn =
      path[0].toLowerCase() === token0.toLowerCase()
        ? reserves[0]
        : reserves[1];

    // Price impact = amountIn / reserveIn * 100
    const impact = (Number(amountIn) / Number(reserveIn)) * 100;
    return Math.round(impact * 100) / 100; // Round to 2 decimal places
  } catch {
    return 0;
  }
}

/**
 * Calculate minimum output with slippage tolerance
 */
export function calculateMinOutput(
  amountOut: bigint,
  slippagePercent: number
): bigint {
  const slippageBps = BigInt(Math.floor(slippagePercent * 100));
  return amountOut - (amountOut * slippageBps) / 10000n;
}

/**
 * Get quote with slippage applied
 */
export async function getQuoteWithSlippage(
  routerAddress: string,
  factoryAddress: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  slippagePercent: number,
  provider: Provider
): Promise<{ quote: SwapQuote; minAmountOut: bigint }> {
  const quote = await getSwapQuote(
    routerAddress,
    factoryAddress,
    tokenIn,
    tokenOut,
    amountIn,
    provider
  );

  const minAmountOut = calculateMinOutput(quote.amountOut, slippagePercent);

  return { quote, minAmountOut };
}

// ==================== POOL INFO ====================

/**
 * Get pool information
 */
export async function getPoolInfo(
  factoryAddress: string,
  tokenA: string,
  tokenB: string,
  provider: Provider
): Promise<PoolInfo | null> {
  const factory = new Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, provider);

  const pairAddress = await factory.getPair(tokenA, tokenB);
  if (pairAddress === ethers.ZeroAddress) {
    return null;
  }

  const pair = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);

  const [token0, token1, reserves, totalSupply] = await Promise.all([
    pair.token0(),
    pair.token1(),
    pair.getReserves(),
    pair.totalSupply(),
  ]);

  return {
    pairAddress,
    token0,
    token1,
    reserve0: reserves[0],
    reserve1: reserves[1],
    totalSupply,
  };
}

/**
 * Get LP token balance
 */
export async function getLPBalance(
  pairAddress: string,
  holderAddress: string,
  provider: Provider
): Promise<bigint> {
  const pair = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, provider);
  return pair.balanceOf(holderAddress);
}

// ==================== SWAP ENCODING ====================

/**
 * Encode token swap via UP execute
 */
export function encodeSwapExactTokensForTokens(
  routerAddress: string,
  params: SwapParams,
  recipient: string
): ExecuteParams {
  const routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);

  const path = params.path || [params.tokenIn, params.tokenOut];

  const swapCalldata = routerInterface.encodeFunctionData(
    'swapExactTokensForTokens',
    [params.amountIn, params.amountOutMin, path, recipient, params.deadline]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: routerAddress,
    value: 0n,
    data: swapCalldata,
  };
}

/**
 * Encode LYX -> Token swap via UP execute
 */
export function encodeSwapExactETHForTokens(
  routerAddress: string,
  amountIn: bigint,
  amountOutMin: bigint,
  path: string[],
  recipient: string,
  deadline: number
): ExecuteParams {
  const routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);

  const swapCalldata = routerInterface.encodeFunctionData(
    'swapExactETHForTokens',
    [amountOutMin, path, recipient, deadline]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: routerAddress,
    value: amountIn,
    data: swapCalldata,
  };
}

/**
 * Encode Token -> LYX swap via UP execute
 */
export function encodeSwapExactTokensForETH(
  routerAddress: string,
  amountIn: bigint,
  amountOutMin: bigint,
  path: string[],
  recipient: string,
  deadline: number
): ExecuteParams {
  const routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);

  const swapCalldata = routerInterface.encodeFunctionData(
    'swapExactTokensForETH',
    [amountIn, amountOutMin, path, recipient, deadline]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: routerAddress,
    value: 0n,
    data: swapCalldata,
  };
}

// ==================== LIQUIDITY ENCODING ====================

/**
 * Encode add liquidity via UP execute
 */
export function encodeAddLiquidity(
  routerAddress: string,
  params: LiquidityParams,
  recipient: string
): ExecuteParams {
  const routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);

  const addLiquidityCalldata = routerInterface.encodeFunctionData(
    'addLiquidity',
    [
      params.tokenA,
      params.tokenB,
      params.amountADesired,
      params.amountBDesired,
      params.amountAMin,
      params.amountBMin,
      recipient,
      params.deadline,
    ]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: routerAddress,
    value: 0n,
    data: addLiquidityCalldata,
  };
}

/**
 * Encode add liquidity with LYX via UP execute
 */
export function encodeAddLiquidityETH(
  routerAddress: string,
  token: string,
  amountTokenDesired: bigint,
  amountTokenMin: bigint,
  amountETHMin: bigint,
  amountETH: bigint,
  recipient: string,
  deadline: number
): ExecuteParams {
  const routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);

  const addLiquidityCalldata = routerInterface.encodeFunctionData(
    'addLiquidityETH',
    [
      token,
      amountTokenDesired,
      amountTokenMin,
      amountETHMin,
      recipient,
      deadline,
    ]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: routerAddress,
    value: amountETH,
    data: addLiquidityCalldata,
  };
}

/**
 * Encode remove liquidity via UP execute
 */
export function encodeRemoveLiquidity(
  routerAddress: string,
  tokenA: string,
  tokenB: string,
  liquidity: bigint,
  amountAMin: bigint,
  amountBMin: bigint,
  recipient: string,
  deadline: number
): ExecuteParams {
  const routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);

  const removeLiquidityCalldata = routerInterface.encodeFunctionData(
    'removeLiquidity',
    [tokenA, tokenB, liquidity, amountAMin, amountBMin, recipient, deadline]
  );

  return {
    operationType: OPERATION_TYPES.CALL,
    target: routerAddress,
    value: 0n,
    data: removeLiquidityCalldata,
  };
}

/**
 * Encode LP token approval (ERC20 style for LP tokens)
 */
export function encodeLPApproval(
  pairAddress: string,
  spender: string,
  amount: bigint
): ExecuteParams {
  const pairInterface = new ethers.Interface(UNISWAP_V2_PAIR_ABI);

  const approveCalldata = pairInterface.encodeFunctionData('approve', [
    spender,
    amount,
  ]);

  return {
    operationType: OPERATION_TYPES.CALL,
    target: pairAddress,
    value: 0n,
    data: approveCalldata,
  };
}

// ==================== HELPERS ====================

/**
 * Get default deadline (20 minutes from now)
 */
export function getDeadline(secondsFromNow: number = DEFAULTS.transactionDeadline): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

/**
 * Check if token needs approval for router
 */
export async function needsRouterApproval(
  tokenAddress: string,
  ownerAddress: string,
  routerAddress: string,
  amount: bigint,
  provider: Provider
): Promise<boolean> {
  // For LSP7 tokens, check authorized amount
  // This is a simplified check - real implementation would verify interface
  const token = new Contract(
    tokenAddress,
    ['function authorizedAmountFor(address,address) view returns (uint256)'],
    provider
  );

  try {
    const authorized = await token.authorizedAmountFor(routerAddress, ownerAddress);
    return BigInt(authorized) < amount;
  } catch {
    // Might be ERC20, check allowance
    const erc20Token = new Contract(
      tokenAddress,
      ['function allowance(address,address) view returns (uint256)'],
      provider
    );

    try {
      const allowance = await erc20Token.allowance(ownerAddress, routerAddress);
      return BigInt(allowance) < amount;
    } catch {
      return true; // Assume approval needed if can't check
    }
  }
}
