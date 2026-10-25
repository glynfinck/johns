import { QueryClient } from '@tanstack/react-query';

/**
 * A fresh cache for one test. No retries, so a failed read shows at once;
 * and no garbage collection, whose five-minute timer would otherwise keep
 * Jest running after a test that leaves a read pending.
 */
export function testQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}
