import { useEffect, useCallback, useMemo } from 'react';
import { Search, Table, Eye, X } from 'lucide-react';
import { useCommandPaletteStore } from '../store/command-palette-store';
import { useQueryStore } from '../store/query-store';
import { schemaCatalog } from '../sql-completion/schema-catalog';
import type { CommandPaletteItem } from '../store/command-palette-store';
import { useConnectionStore } from '../store/connection-store';
import { ensureDefaultSchemaInitialized } from '../utils/schema-init';

export function CommandPalette() {
  const {
    isOpen,
    query,
    items,
    selectedIndex,
    close,
    setQuery,
    setItems,
    selectNext,
    selectPrevious,
  } = useCommandPaletteStore();

  const { activeTabId, updateQuery } = useQueryStore();
  const { connections, activeConnectionId } = useConnectionStore();
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const engine = activeConnection?.engine || 'postgresql';

  const quoteIdentifier = useCallback((name: string, eng: typeof engine): string => {
    if (!name) return '';
    switch (eng) {
      case 'mysql':
        return `\`${name}\``;
      case 'postgresql':
        return `"${name}"`;
      case 'sqlite':
        return `"${name}"`;
      default:
        return `"${name}"`;
    }
  }, []);

  const formatFullName = useCallback(
    (schema: string | undefined, table: string): string => {
      const quotedTable = quoteIdentifier(table, engine);
      if (schema) {
        return `${quoteIdentifier(schema, engine)}.${quotedTable}`;
      }
      return quotedTable;
    },
    [engine, quoteIdentifier]
  );

  // Búsqueda fuzzy en tiempo real
  const searchResults = useMemo(() => {
    const allTables = schemaCatalog.getTables();
    
    if (!query) {
      // Sin query, mostrar todas las tablas
      return allTables.map((table) => {
        const fullName = table.schema
          ? `${table.schema}.${table.name}`
          : table.name;
        
        return {
          id: fullName,
          type: table.type,
          name: table.name,
          schema: table.schema,
          database: table.database,
          fullName,
          table,
        } as CommandPaletteItem;
      });
    }

    // Búsqueda fuzzy
    const lowerQuery = query.toLowerCase();
    
    return allTables
      .map((table) => {
        const fullName = table.schema
          ? `${table.schema}.${table.name}`
          : table.name;
        
        const nameMatch = table.name.toLowerCase().includes(lowerQuery);
        const schemaMatch = table.schema?.toLowerCase().includes(lowerQuery);
        const fullNameMatch = fullName.toLowerCase().includes(lowerQuery);
        
        // Score simple para ordenar resultados
        let score = 0;
        if (table.name.toLowerCase().startsWith(lowerQuery)) score += 10;
        if (nameMatch) score += 5;
        if (schemaMatch) score += 3;
        if (fullNameMatch) score += 1;
        
        return {
          id: fullName,
          type: table.type,
          name: table.name,
          schema: table.schema,
          database: table.database,
          fullName,
          table,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Limitar a 50 resultados
      .map(({ score, ...item }) => item as CommandPaletteItem);
  }, [query, isOpen]);

  useEffect(() => {
    setItems(searchResults);
  }, [searchResults, setItems]);
  
  useEffect(() => {
    if (!isOpen || !activeConnectionId || !activeConnection || !schemaCatalog.isEmpty()) return;
    ensureDefaultSchemaInitialized(activeConnection);
  }, [isOpen, activeConnectionId, engine, activeConnection]);

  const handleSelect = useCallback(
    (item: CommandPaletteItem) => {
      if (!activeTabId) return;

      // Insertar SELECT * FROM en el editor
      const sql = `SELECT * FROM ${formatFullName(item.schema, item.name)} LIMIT 100`;
      updateQuery(activeTabId, sql);
      
      close();
    },
    [activeTabId, updateQuery, close, formatFullName]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          break;
        case 'ArrowDown':
          e.preventDefault();
          selectNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectPrevious();
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            handleSelect(items[selectedIndex]);
          }
          break;
      }
    },
    [close, selectNext, selectPrevious, items, selectedIndex, handleSelect]
  );

  useEffect(() => {
    if (isOpen) {
      // Scroll al elemento seleccionado
      const element = document.getElementById(`palette-item-${selectedIndex}`);
      element?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={close}
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-lg shadow-2xl w-[600px] max-h-[500px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
          <Search className="w-5 h-5 text-dark-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tablas y vistas..."
            className="flex-1 bg-transparent outline-none text-white placeholder-dark-muted"
            autoFocus
          />
          <button
            onClick={close}
            className="text-dark-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-dark-muted">
              <Table className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No se encontraron tablas</p>
            </div>
          ) : (
            <div>
              {items.map((item, index) => (
                <button
                  key={item.id}
                  id={`palette-item-${index}`}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b border-dark-border last:border-b-0 ${
                    index === selectedIndex
                      ? 'bg-primary-500/20 border-l-2 border-l-primary-500'
                      : 'hover:bg-dark-hover'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center ${
                      item.type === 'table'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}
                  >
                    {item.type === 'table' ? (
                      <Table className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm truncate">
                      {item.schema && (
                        <span className="text-primary-400">{item.schema}.</span>
                      )}
                      <span className="text-white">{item.name}</span>
                    </div>
                    <div className="text-xs text-dark-muted">
                      {item.type === 'table' ? 'Tabla' : 'Vista'} •{' '}
                      {item.table?.columns.length || 0} columnas
                    </div>
                  </div>
                  <div className="text-xs text-dark-muted">
                    Enter
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-dark-border flex items-center justify-between text-xs text-dark-muted">
          <div className="flex items-center gap-4">
            <span>↑↓ Navegar</span>
            <span>Enter Seleccionar</span>
            <span>Esc Cerrar</span>
          </div>
          <div>{items.length} resultados</div>
        </div>
      </div>
    </div>
  );
}
