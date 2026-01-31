import type * as Monaco from 'monaco-editor';
import { schemaCatalog } from './schema-catalog';
import { aliasParser, type CursorContext } from './alias-parser';
import {
  getDialectStrategy,
  generateTableSuggestions,
  generateSchemaSuggestions,
  generateColumnSuggestions,
  type CompletionSuggestion,
} from './dialect-strategy';

/**
 * Convierte el tipo de sugerencia a CompletionItemKind de Monaco
 */
function toMonacoKind(
  kind: CompletionSuggestion['kind'],
  monaco: typeof Monaco
): Monaco.languages.CompletionItemKind {
  switch (kind) {
    case 'schema':
      return monaco.languages.CompletionItemKind.Module;
    case 'table':
      return monaco.languages.CompletionItemKind.Class;
    case 'view':
      return monaco.languages.CompletionItemKind.Interface;
    case 'column':
      return monaco.languages.CompletionItemKind.Field;
    case 'keyword':
      return monaco.languages.CompletionItemKind.Keyword;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}

/**
 * Convierte sugerencias internas a formato Monaco
 */
function toMonacoCompletionItems(
  suggestions: CompletionSuggestion[],
  range: Monaco.IRange,
  monaco: typeof Monaco
): Monaco.languages.CompletionItem[] {
  return suggestions.map((s) => ({
    label: s.label,
    kind: toMonacoKind(s.kind, monaco),
    insertText: s.insertText,
    detail: s.detail,
    documentation: s.documentation,
    sortText: String(s.sortOrder).padStart(5, '0'),
    range,
  }));
}

/**
 * Genera sugerencias de keywords SQL
 */
function generateKeywordSuggestions(
  prefix: string
): CompletionSuggestion[] {
  const strategy = getDialectStrategy(schemaCatalog.getEngine());
  const keywords = strategy.getKeywords();
  const upperPrefix = prefix.toUpperCase();

  return keywords
    .filter((kw) => kw.startsWith(upperPrefix))
    .map((kw, index) => ({
      label: kw,
      insertText: kw,
      kind: 'keyword' as const,
      detail: 'Keyword',
      sortOrder: 100 + index, // Keywords al final
    }));
}

/**
 * Determina qué sugerencias mostrar según el contexto
 */
function getSuggestionsForContext(
  context: CursorContext,
  currentWord: string,
  prefix: string | undefined,
  aliases: Map<string, string>
): CompletionSuggestion[] {
  const strategy = getDialectStrategy(schemaCatalog.getEngine());
  const suggestions: CompletionSuggestion[] = [];

  // Si hay un prefijo (alias. o tabla.), sugerir columnas
  if (prefix) {
    const tableName = aliasParser.resolveAlias(aliases, prefix);
    const columnSuggestions = generateColumnSuggestions(
      schemaCatalog,
      tableName,
      currentWord
    );
    return columnSuggestions;
  }

  // Según el contexto, sugerir diferentes cosas
  switch (context) {
    case 'from_clause':
      // Sugerir schemas y tablas
      suggestions.push(...generateSchemaSuggestions(schemaCatalog, strategy));
      suggestions.push(
        ...generateTableSuggestions(schemaCatalog, strategy, currentWord)
      );
      break;

    case 'select_columns':
    case 'where_clause':
    case 'join_condition':
    case 'order_by':
    case 'group_by':
      // Sugerir alias disponibles y columnas de tablas conocidas
      for (const [alias, tableName] of aliases) {
        suggestions.push({
          label: alias,
          insertText: alias,
          kind: 'table',
          detail: `Alias → ${tableName}`,
          sortOrder: 0,
        });
      }
      // También sugerir tablas directamente
      suggestions.push(
        ...generateTableSuggestions(schemaCatalog, strategy, currentWord)
      );
      break;

    case 'general':
    default:
      // Sugerir keywords, tablas y schemas
      suggestions.push(...generateKeywordSuggestions(currentWord));
      suggestions.push(...generateSchemaSuggestions(schemaCatalog, strategy));
      suggestions.push(
        ...generateTableSuggestions(schemaCatalog, strategy, currentWord)
      );
      break;
  }

  return suggestions;
}

/**
 * Crea el CompletionItemProvider para Monaco Editor
 */
export function createSqlCompletionProvider(
  monaco: typeof Monaco
): Monaco.languages.CompletionItemProvider {
  // Cache para evitar recálculos
  let lastQuery = '';
  let lastPosition = 0;
  let cachedContext: ReturnType<typeof aliasParser.parse> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    triggerCharacters: ['.', ' '],

    provideCompletionItems(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position
    ): Monaco.languages.ProviderResult<Monaco.languages.CompletionList> {
      // Si el catálogo está vacío, no sugerir nada
      if (schemaCatalog.isEmpty()) {
        return { suggestions: [] };
      }

      const query = model.getValue();
      const offset = model.getOffsetAt(position);

      // Debounce: evitar recálculos en cada keypress
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Usar cache si la query no cambió significativamente
      const queryChanged = query !== lastQuery;
      const positionChanged = Math.abs(offset - lastPosition) > 5;

      if (queryChanged || positionChanged || !cachedContext) {
        cachedContext = aliasParser.parse(query, offset);
        lastQuery = query;
        lastPosition = offset;
      }

      const { aliases, cursorContext, currentWord, prefix } = cachedContext;

      // Calcular el rango de reemplazo
      const wordInfo = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        startColumn: prefix
          ? position.column - currentWord.length - prefix.length - 1
          : wordInfo.startColumn,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };

      // Obtener sugerencias según contexto
      const suggestions = getSuggestionsForContext(
        cursorContext,
        currentWord,
        prefix,
        aliases
      );

      return {
        suggestions: toMonacoCompletionItems(suggestions, range, monaco),
      };
    },
  };
}

/**
 * Registra el provider de autocompletado SQL en Monaco
 */
export function registerSqlCompletionProvider(
  monaco: typeof Monaco
): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider(
    'sql',
    createSqlCompletionProvider(monaco)
  );
}
