// SQL Completion Module - Autocompletado inteligente para Monaco Editor

export { SchemaCatalog, schemaCatalog } from './schema-catalog';
export type { CatalogTable, CatalogColumn, CatalogSchema } from './schema-catalog';

export { AliasParser, aliasParser } from './alias-parser';
export type { AliasMap, SqlContext, CursorContext } from './alias-parser';

export {
  getDialectStrategy,
  generateTableSuggestions,
  generateSchemaSuggestions,
  generateColumnSuggestions,
} from './dialect-strategy';
export type { SqlDialectStrategy, CompletionSuggestion } from './dialect-strategy';

export {
  createSqlCompletionProvider,
  registerSqlCompletionProvider,
} from './completion-provider';

export { useSqlCompletion } from './use-sql-completion';
