import type { DatabaseEngine } from '../domain/types';

export interface EngineCapabilities {
  transactions: boolean;
  tempTables: boolean;
  supportsReturning: boolean;
}

export function getEngineCapabilities(engine: DatabaseEngine): EngineCapabilities {
  switch (engine) {
    case 'postgresql':
      return { transactions: true, tempTables: true, supportsReturning: true };
    case 'mysql':
      return { transactions: true, tempTables: true, supportsReturning: false };
    case 'sqlite':
      return { transactions: true, tempTables: true, supportsReturning: false };
    case 'sqlserver':
      return { transactions: true, tempTables: true, supportsReturning: true };
    default:
      return { transactions: true, tempTables: false, supportsReturning: false };
  }
}
