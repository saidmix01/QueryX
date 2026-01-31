import { useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import Editor, { useMonaco } from '@monaco-editor/react';
import { Play, Square, Loader2, Boxes, Code2, List, Save as SaveIcon, FolderOpen } from 'lucide-react';
import { useQueryStore } from '../store/query-store';
import { useQueryBuilderStore } from '../store/query-builder-store';
import { useSqlCompletion } from '../sql-completion/use-sql-completion';
import { parseMultipleStatements, findStatementAtCursor } from '../utils/sql-parser';
import { useConnectionStore } from '../store/connection-store';
import { schemaCatalog } from '../sql-completion/schema-catalog';
import { ensureDefaultSchemaInitialized } from '../utils/schema-init';
import { save, open } from '@tauri-apps/api/dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/api/fs';

interface QueryEditorProps {
  tab: {
    id: string;
    query: string;
    isExecuting: boolean;
  };
}

export function QueryEditor({ tab }: QueryEditorProps) {
  const { updateQuery, executeQuery, executeMultiStatement, cancelQuery } = useQueryStore();
  const openQueryBuilder = useQueryBuilderStore((s) => s.open);
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const { connections, activeConnectionId } = useConnectionStore();
  
  useSqlCompletion(monaco);
  
  useEffect(() => {
    const activeConnection = connections.find((c) => c.id === activeConnectionId);
    if (!activeConnectionId || !activeConnection || !schemaCatalog.isEmpty()) return;
    ensureDefaultSchemaInitialized(activeConnection);
  }, [activeConnectionId, connections]);

  // Memoizar el parsing para evitar re-calcular en cada render
  const statements = useMemo(() => {
    if (!tab.query.trim()) return [];
    return parseMultipleStatements(tab.query);
  }, [tab.query]);

  const hasMultipleStatements = statements.length > 1;

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      updateQuery(tab.id, value || '');
    },
    [tab.id, updateQuery]
  );

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const handleExecuteCurrent = useCallback(() => {
    if (!editorRef.current) {
      executeQuery(tab.id);
      return;
    }

    const position = editorRef.current.getPosition();
    const offset = editorRef.current.getModel().getOffsetAt(position);
    
    const statementAtCursor = findStatementAtCursor(tab.query, offset);
    
    if (statementAtCursor) {
      // Ejecutar solo el statement actual
      executeQuery(tab.id, statementAtCursor.statement.sql);
    } else {
      // Si no se encuentra, ejecutar todo
      executeQuery(tab.id);
    }
  }, [tab.id, tab.query, executeQuery]);

  const handleExecuteAll = useCallback(() => {
    if (statements.length > 1) {
      // Ejecutar múltiples statements
      executeMultiStatement(tab.id);
    } else {
      // Ejecutar uno solo
      executeQuery(tab.id);
    }
  }, [tab.id, statements.length, executeMultiStatement, executeQuery]);

  const handleCancel = useCallback(() => {
    cancelQuery(tab.id);
  }, [tab.id, cancelQuery]);

  const handleSaveSql = useCallback(async () => {
    const filePath = await save({
      filters: [{ name: 'SQL', extensions: ['sql'] }],
      defaultPath: 'query.sql',
    });
    if (!filePath) return;
    await writeTextFile(filePath as string, tab.query || '');
  }, [tab.query]);

  const handleOpenSql = useCallback(async () => {
    const filePath = await open({
      filters: [{ name: 'SQL', extensions: ['sql'] }],
      multiple: false,
    });
    if (!filePath || Array.isArray(filePath)) return;
    const content = await readTextFile(filePath as string);
    updateQuery(tab.id, content);
  }, [tab.id, updateQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleExecuteAll();
        } else {
          handleExecuteCurrent();
        }
      }
    },
    [handleExecuteCurrent, handleExecuteAll]
  );

  return (
    <div className="h-full flex flex-col bg-dark-bg" onKeyDown={handleKeyDown}>
      {/* Toolbar - Flotante y ultra minimalista */}
      <motion.div 
        initial={{ y: -5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="flex items-center justify-between px-3 py-1.5 bg-dark-surface/70 backdrop-blur-md border-b border-dark-border/30"
      >
        {/* Acciones principales */}
        <div className="flex items-center gap-1.5">
          {tab.isExecuting ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCancel}
              className="btn btn-danger flex items-center gap-1.5 text-xs py-1 px-2.5 h-7"
            >
              <Square className="w-3 h-3" />
              Cancel
            </motion.button>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExecuteCurrent}
                disabled={!tab.query.trim()}
                className="btn btn-primary flex items-center gap-1.5 text-xs py-1 px-2.5 h-7 shadow-glow-sm"
                title="Run current statement (Ctrl+Enter)"
              >
                <Play className="w-3 h-3" />
                Run
              </motion.button>

              {hasMultipleStatements && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExecuteAll}
                  className="btn btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5 h-7"
                  title="Run all statements (Ctrl+Shift+Enter)"
                >
                  <List className="w-3 h-3" />
                  Run All ({statements.length})
                </motion.button>
              )}
            </>
          )}
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenSql}
            className="btn btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5 h-7"
            title="Abrir .sql"
          >
            <FolderOpen className="w-3 h-3" />
            Abrir
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveSql}
            className="btn btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5 h-7"
            title="Guardar .sql"
          >
            <SaveIcon className="w-3 h-3" />
            Guardar
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openQueryBuilder}
            className="btn btn-secondary flex items-center gap-1.5 text-xs py-1 px-2.5 h-7"
            title="Visual Query Builder (Ctrl+Shift+B)"
          >
            <Boxes className="w-3 h-3" />
            Builder
          </motion.button>

          {/* Indicador de ejecución */}
          {tab.isExecuting && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              className="flex items-center gap-1.5 text-matrix-400 ml-1"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs font-medium">Executing...</span>
            </motion.div>
          )}
        </div>

        {/* Shortcuts hint - Lado derecho */}
        <div className="flex items-center gap-2.5 text-xs text-dark-muted/60">
          <div className="flex items-center gap-1">
            <Code2 className="w-3 h-3 text-matrix-500/70" />
            <span className="text-[11px]">SQL Editor</span>
          </div>
          <div className="h-3 w-px bg-dark-border/30" />
          <div className="flex items-center gap-1">
            <kbd className="text-[10px] px-1.5 py-0.5">Ctrl+Enter</kbd>
            <span className="text-[11px]">Run</span>
          </div>
          {hasMultipleStatements && (
            <>
              <div className="flex items-center gap-1">
                <kbd className="text-[10px] px-1.5 py-0.5">Ctrl+Shift+Enter</kbd>
                <span className="text-[11px]">Run All</span>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Monaco Editor - Ocupa todo el espacio disponible */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={tab.query}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            lineHeight: 21,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            renderLineHighlight: 'line',
            renderWhitespace: 'selection',
            folding: true,
            foldingHighlight: true,
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            // Optimizaciones de rendimiento
            acceptSuggestionOnCommitCharacter: true,
            acceptSuggestionOnEnter: 'on',
            accessibilitySupport: 'off',
            codeLens: false,
            contextmenu: true,
            fastScrollSensitivity: 5,
            formatOnPaste: false,
            formatOnType: false,
            glyphMargin: false,
            hover: {
              enabled: true,
              delay: 300,
            },
            links: false,
            mouseWheelZoom: false,
            occurrencesHighlight: 'off',
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            quickSuggestionsDelay: 100,
            renderControlCharacters: false,
            renderFinalNewline: 'off',
            renderLineHighlightOnlyWhenFocus: true,
            renderValidationDecorations: 'on',
            scrollbar: {
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            selectionHighlight: false,
            snippetSuggestions: 'top',
            suggest: {
              filterGraceful: true,
              localityBonus: true,
              shareSuggestSelections: false,
              showIcons: true,
            },
            suggestFontSize: 13,
            suggestLineHeight: 20,
            wordBasedSuggestions: 'off',
          }}
        />
      </div>
    </div>
  );
}
