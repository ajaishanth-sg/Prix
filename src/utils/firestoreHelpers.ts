/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Retries an async operation with exponential backoff.
 * Skips retry for Firebase permission-denied / auth errors.
 */
export async function retryFirestoreOp<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 300
): Promise<T> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }
      const code = error?.code || error?.name;
      if (code === 'permission-denied' || code === 'unauthenticated') {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `Firestore op failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`,
        error?.message || error
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
