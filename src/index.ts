/**
 * Universal Profile Skill - Main Entry Point
 */

// Re-export types
export * from './types/index.js';

// Re-export utilities
export * from './utils/constants.js';
export * from './utils/config.js';

// Re-export contracts
export * from './contracts/index.js';

// Re-export library functions
export * from './lib/index.js';

// Version
export const VERSION = '1.0.0';

/**
 * Quick start helpers for common operations
 */
export { createUniversalProfileSkill } from './skill.js';
