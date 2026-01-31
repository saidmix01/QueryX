/**
 * Parser liviano de SQL para dividir múltiples statements
 * Maneja correctamente strings, comentarios y casos especiales
 */

export interface ParsedStatement {
  sql: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

export interface StatementAtCursor {
  statement: ParsedStatement;
  index: number;
}

// Cache para evitar re-parsing del mismo SQL
const parseCache = new Map<string, ParsedStatement[]>();
const MAX_CACHE_SIZE = 50;

/**
 * Divide un texto SQL en múltiples statements
 * Ignora ; dentro de strings y comentarios
 */
export function parseMultipleStatements(sql: string): ParsedStatement[] {
  // Verificar cache
  const cached = parseCache.get(sql);
  if (cached) {
    return cached;
  }

  const statements: ParsedStatement[] = [];
  let currentStatement = '';
  let startOffset = 0;
  let startLine = 1;
  let currentLine = 1;
  
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Track line numbers
    if (char === '\n') {
      currentLine++;
      if (inLineComment) {
        inLineComment = false;
      }
    }

    // Handle escape sequences
    if (escaped) {
      currentStatement += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
      escaped = true;
      currentStatement += char;
      continue;
    }

    // Handle comments
    if (!inSingleQuote && !inDoubleQuote) {
      // Start of line comment
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        currentStatement += char;
        continue;
      }

      // Start of block comment
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        currentStatement += char;
        continue;
      }

      // End of block comment
      if (inBlockComment && char === '*' && nextChar === '/') {
        currentStatement += char + nextChar;
        i++; // Skip next char
        inBlockComment = false;
        continue;
      }
    }

    // If we're in a comment, just add the character
    if (inLineComment || inBlockComment) {
      currentStatement += char;
      continue;
    }

    // Handle string delimiters
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      currentStatement += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      currentStatement += char;
      continue;
    }

    // Handle statement separator
    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      currentStatement += char;
      const trimmed = currentStatement.trim();
      
      if (trimmed && trimmed !== ';') {
        statements.push({
          sql: trimmed,
          startLine,
          endLine: currentLine,
          startOffset,
          endOffset: i + 1,
        });
      }
      
      currentStatement = '';
      startOffset = i + 1;
      startLine = currentLine;
      continue;
    }

    currentStatement += char;
  }

  // Add last statement if exists
  const trimmed = currentStatement.trim();
  if (trimmed) {
    statements.push({
      sql: trimmed,
      startLine,
      endLine: currentLine,
      startOffset,
      endOffset: sql.length,
    });
  }

  // Guardar en cache
  if (parseCache.size >= MAX_CACHE_SIZE) {
    // Eliminar el primer elemento (FIFO)
    const firstKey = parseCache.keys().next().value;
    if (firstKey !== undefined) {
      parseCache.delete(firstKey);
    }
  }
  parseCache.set(sql, statements);

  return statements;
}

/**
 * Encuentra el statement en la posición del cursor
 */
export function findStatementAtCursor(
  sql: string,
  cursorOffset: number
): StatementAtCursor | null {
  const statements = parseMultipleStatements(sql);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (cursorOffset >= stmt.startOffset && cursorOffset <= stmt.endOffset) {
      return { statement: stmt, index: i };
    }
  }

  return null;
}

/**
 * Detecta si un statement es potencialmente destructivo
 */
export function isDestructiveStatement(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  return (
    normalized.startsWith('UPDATE') ||
    normalized.startsWith('DELETE') ||
    normalized.startsWith('DROP') ||
    normalized.startsWith('TRUNCATE') ||
    normalized.startsWith('ALTER')
  );
}

/**
 * Detecta el tipo de statement
 */
export type StatementType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'OTHER';

export function detectStatementType(sql: string): StatementType {
  const normalized = sql.trim().toUpperCase();
  
  if (normalized.startsWith('SELECT') || normalized.startsWith('WITH')) {
    return 'SELECT';
  }
  if (normalized.startsWith('INSERT')) {
    return 'INSERT';
  }
  if (normalized.startsWith('UPDATE')) {
    return 'UPDATE';
  }
  if (normalized.startsWith('DELETE')) {
    return 'DELETE';
  }
  if (
    normalized.startsWith('CREATE') ||
    normalized.startsWith('ALTER') ||
    normalized.startsWith('DROP') ||
    normalized.startsWith('TRUNCATE')
  ) {
    return 'DDL';
  }
  
  return 'OTHER';
}
