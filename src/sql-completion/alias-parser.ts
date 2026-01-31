/**
 * Mapa de alias detectados en la query
 * Clave: alias, Valor: nombre de tabla
 */
export type AliasMap = Map<string, string>;

/**
 * Resultado del análisis de contexto SQL
 */
export interface SqlContext {
  /** Mapa de alias detectados */
  aliases: AliasMap;
  /** Contexto actual del cursor */
  cursorContext: CursorContext;
  /** Palabra actual que se está escribiendo */
  currentWord: string;
  /** Prefijo antes del punto (si existe) */
  prefix?: string;
}

export type CursorContext =
  | 'select_columns'    // Después de SELECT, antes de FROM
  | 'from_clause'       // Después de FROM o JOIN
  | 'where_clause'      // Después de WHERE
  | 'join_condition'    // Después de ON
  | 'order_by'          // Después de ORDER BY
  | 'group_by'          // Después de GROUP BY
  | 'general';          // Contexto general

/**
 * AliasParser - Parser liviano para detectar alias y contexto SQL
 * No hace parsing completo, solo extrae información relevante para autocompletado
 */
export class AliasParser {
  // Regex para detectar alias en FROM/JOIN
  // Patrones: FROM table alias, FROM table AS alias, JOIN table alias, JOIN table AS alias
  private static readonly TABLE_ALIAS_PATTERN =
    /(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\s+(?:AS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;

  // Keywords SQL que indican contexto
  private static readonly CONTEXT_KEYWORDS = [
    'SELECT', 'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS',
    'WHERE', 'AND', 'OR', 'ON', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT',
    'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES', 'INTO'
  ];

  /**
   * Analiza una query SQL y extrae alias y contexto
   */
  parse(sql: string, cursorPosition: number): SqlContext {
    const aliases = this.extractAliases(sql);
    const cursorContext = this.detectCursorContext(sql, cursorPosition);
    const { currentWord, prefix } = this.extractCurrentWord(sql, cursorPosition);

    return {
      aliases,
      cursorContext,
      currentWord,
      prefix,
    };
  }

  /**
   * Extrae todos los alias de tabla de la query
   */
  extractAliases(sql: string): AliasMap {
    const aliases: AliasMap = new Map();
    
    // Normalizar espacios y saltos de línea
    const normalizedSql = sql.replace(/\s+/g, ' ');

    // Buscar patrones de alias
    let match: RegExpExecArray | null;
    
    // Reset regex
    AliasParser.TABLE_ALIAS_PATTERN.lastIndex = 0;
    
    while ((match = AliasParser.TABLE_ALIAS_PATTERN.exec(normalizedSql)) !== null) {
      const tableName = match[1];
      const alias = match[2];
      
      // Verificar que el alias no sea una keyword SQL
      if (!this.isKeyword(alias)) {
        aliases.set(alias.toLowerCase(), tableName);
      }
    }

    return aliases;
  }

  /**
   * Detecta el contexto del cursor basado en la posición
   */
  private detectCursorContext(sql: string, position: number): CursorContext {
    // Obtener el texto antes del cursor
    const textBefore = sql.substring(0, position).toUpperCase();
    
    // Buscar la última keyword relevante
    const keywords = [
      { pattern: /\bSELECT\b(?!.*\bFROM\b)/i, context: 'select_columns' as const },
      { pattern: /\b(?:FROM|JOIN)\s+[^,]*$/i, context: 'from_clause' as const },
      { pattern: /\bWHERE\b(?!.*\b(?:ORDER|GROUP)\b)/i, context: 'where_clause' as const },
      { pattern: /\bON\s+[^,]*$/i, context: 'join_condition' as const },
      { pattern: /\bORDER\s+BY\b/i, context: 'order_by' as const },
      { pattern: /\bGROUP\s+BY\b/i, context: 'group_by' as const },
    ];

    // Buscar desde el final hacia atrás
    for (const { pattern, context } of keywords) {
      if (pattern.test(textBefore)) {
        return context;
      }
    }

    return 'general';
  }

  /**
   * Extrae la palabra actual y el prefijo (antes del punto)
   */
  private extractCurrentWord(
    sql: string,
    position: number
  ): { currentWord: string; prefix?: string } {
    // Obtener texto antes del cursor
    const textBefore = sql.substring(0, position);
    
    // Buscar el inicio de la palabra actual
    const wordMatch = textBefore.match(/([a-zA-Z_][a-zA-Z0-9_]*)?\.?([a-zA-Z_][a-zA-Z0-9_]*)?$/);
    
    if (!wordMatch) {
      return { currentWord: '' };
    }

    const fullMatch = wordMatch[0];
    
    // Si hay un punto, separar prefijo y palabra actual
    if (fullMatch.includes('.')) {
      const parts = fullMatch.split('.');
      return {
        prefix: parts[0],
        currentWord: parts[1] || '',
      };
    }

    return { currentWord: fullMatch };
  }

  /**
   * Verifica si una palabra es una keyword SQL
   */
  private isKeyword(word: string): boolean {
    return AliasParser.CONTEXT_KEYWORDS.includes(word.toUpperCase());
  }

  /**
   * Resuelve un alias a su nombre de tabla
   */
  resolveAlias(aliases: AliasMap, aliasOrTable: string): string {
    return aliases.get(aliasOrTable.toLowerCase()) || aliasOrTable;
  }
}

// Singleton del parser
export const aliasParser = new AliasParser();
