/**
 * Utility for generating unique IDs throughout the application.
 *
 * Provides consistent ID generation patterns replacing scattered
 * implementations that used Date.now() + Math.random().
 */

/**
 * Generate a unique ID with a prefix.
 *
 * Format: `{prefix}-{timestamp}-{random}`
 * Example: `district-1738761234567-k3j8f9g2h`
 *
 * @param prefix - The prefix for the ID (e.g., 'district', 'road', 'seed')
 * @returns A unique string ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate a unique ID without a prefix.
 *
 * Format: `{timestamp}-{random}`
 * Useful when the context is already clear.
 *
 * @returns A unique string ID
 */
export function generateSimpleId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
