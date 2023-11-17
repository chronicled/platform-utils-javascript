import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

export type Returns<T> = () => T;

export interface CorrelationContext {
  correlationId?: string;
  causationId?: string;
  messageId?: string;
  tenantId?: string;
  inputMessage?: any;
}

export function currentCorrelationContext(): CorrelationContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Generates a new correlation context with predefined correlation data.
 */
export function withCorrelationContext<T>(
  correlationData: CorrelationContext,
  fn: Returns<T>
): T {
  return (asyncLocalStorage.run(correlationData, fn) as any) as T;
}
