import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Clock, Rows3, ChevronLeft, ChevronRight, X, Copy, Check, Edit2, Save, XCircle, Trash2, Key, Plus, Minus, Search, Plus as PlusIcon, ArrowUpDown, ArrowUp, ArrowDown, Maximize2 } from 'lucide-react';

interface CellEditorModalProps {
  initialValue: string;
  columnName: string;
  dataType: string;
  onSave: (newValue: string) => void;
  onClose: () => void;
}

function CellEditorModal({ initialValue, columnName, dataType, onSave, onClose }: CellEditorModalProps) {
  const [content, setContent] = useState(initialValue);
  
  // Detectar lenguaje para el editor
  const language = useMemo(() => {
    const dt = dataType.toLowerCase();
    if (dt.includes('json')) return 'json';
    if (dt.includes('xml')) return 'xml';
    if (dt.includes('html')) return 'html';
    if (dt.includes('sql')) return 'sql';
    
    // Auto-detección basada en contenido
    const trimmed = content.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {}
    }
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) return 'xml';
    
    return 'plaintext';
  }, [dataType, content]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-dark-surface border border-dark-border/50 rounded-lg shadow-2xl w-[800px] max-w-[90vw] h-[600px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-border/50 bg-dark-elevated/50">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-matrix-400" />
            <span className="font-semibold text-dark-text text-sm">Editing: {columnName}</span>
            <span className="text-xs text-dark-muted bg-dark-surface/50 px-2 py-0.5 rounded border border-dark-border/30">
              {dataType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(content)}
              className="btn btn-primary px-3 py-1 text-xs flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              Apply Changes
            </button>
            <button 
              onClick={onClose} 
              className="btn btn-ghost p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Editor */}
        <div className="flex-1 relative">
          <Editor
            height="100%"
            language={language}
            value={content}
            theme="vs-dark"
            onChange={(value) => setContent(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              padding: { top: 12 },
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import clsx from 'clsx';
import type { CellValue, QueryResult } from '../domain/types';
import { useQueryStore } from '../store/query-store';
import { useConnectionStore } from '../store/connection-store';
import { analyzeQueryEditability, generateUpdateStatement, generateDeleteStatement } from '../utils/query-analyzer';
import { schemaApi, exportApi } from '../infrastructure/tauri-api';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';
import { toCsv, toInsertSql, normalizeRowsForExcel } from '../utils/export-utils';
import { QueryToSqlCompiler } from '../query-builder/query-compiler';
import type { Condition, ConditionGroup, ComparisonOperator } from '../domain/query-builder-types';
import { useResultPanelsStore } from '../store/result-panels-store';

interface ResultsTableProps {
  tab: {
    id: string;
    connectionId: string;
    query: string;
    result: QueryResult | null;
    error: string | null;
    isExecuting: boolean;
  };
  hideMenu?: boolean;
}

const MAX_PREVIEW_LENGTH = 100;

function isLongValue(cell: CellValue): boolean {
  if (cell.type === 'String') return cell.value.length > MAX_PREVIEW_LENGTH;
  if (cell.type === 'Json') return JSON.stringify(cell.value).length > MAX_PREVIEW_LENGTH;
  return false;
}

function formatFullValue(cell: CellValue): string {
  if (cell.type === 'Null') return 'NULL';
  if (cell.type === 'Bool') return cell.value ? 'true' : 'false';
  if (cell.type === 'Bytes') return `[${cell.value.length} bytes]`;
  if (cell.type === 'Json') return JSON.stringify(cell.value, null, 2);
  if (cell.type === 'Array') return JSON.stringify(cell.value.map(v => formatFullValue(v)), null, 2);
  return String(cell.value);
}

function formatCellPreview(cell: CellValue): string {
  const full = formatFullValue(cell);
  if (full.length > MAX_PREVIEW_LENGTH) {
    return full.substring(0, MAX_PREVIEW_LENGTH) + '...';
  }
  return full;
}

function cellValueToRaw(cell: CellValue): any {
  if (cell.type === 'Null') return null;
  if (cell.type === 'Bool') return cell.value;
  if (cell.type === 'Int') return cell.value;
  if (cell.type === 'Float') return cell.value;
  if (cell.type === 'String') return cell.value;
  if (cell.type === 'Json') return cell.value;
  if (cell.type === 'Date') return cell.value;
  if (cell.type === 'Time') return cell.value;
  if (cell.type === 'DateTime') return cell.value;
  if (cell.type === 'Uuid') return cell.value;
  if (cell.type === 'Bytes') return cell.value;
  if (cell.type === 'Array') return cell.value;
  return null;
}

function detectLanguage(cell: CellValue): string {
  if (cell.type === 'Json') return 'json';
  if (cell.type === 'String') {
    const trimmed = cell.value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {}
    }
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
      return 'html';
    }
  }
  return 'plaintext';
}

interface ContentViewerProps {
  value: CellValue;
  columnName: string;
  onClose: () => void;
}

function ContentViewer({ value, columnName, onClose }: ContentViewerProps) {
  const [copied, setCopied] = useState(false);
  const content = formatFullValue(value);
  const language = detectLanguage(value);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-dark-surface border border-dark-border/50 rounded-lg shadow-2xl w-[800px] max-w-[90vw] h-[600px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-border/50 bg-dark-elevated/50">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-matrix-400 text-sm">{columnName}</span>
            <span className="text-xs text-dark-muted bg-dark-surface/50 px-2 py-0.5 rounded border border-dark-border/30">
              {value.type} • {content.length} chars
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCopy}
              className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-matrix-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose} 
              className="btn btn-ghost p-1"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
        
        {/* Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            language={language}
            value={content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
              padding: { top: 12 },
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function MenuActions({
  onModal,
  onPin,
  onCsv,
  onXlsx,
  onInsert,
}: {
  onModal: () => void;
  onPin: () => void;
  onCsv: () => void;
  onXlsx: () => void;
  onInsert: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideTrigger && !insideMenu) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          setOpen((v) => !v);
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            setCoords({ left: Math.min(rect.left, window.innerWidth - 160), top: rect.bottom + 4 });
          }
        }}
        className="btn btn-secondary px-2 py-1 text-xs flex items-center gap-1"
        title="Más acciones"
      >
        <PlusIcon className="w-3 h-3" />
        +
      </button>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          className="fixed w-40 bg-dark-surface border border-dark-border/40 rounded shadow-xl pointer-events-auto"
          style={{ left: coords.left, top: coords.top, zIndex: 100000 }}
        >
          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onModal(); }}>
            Modal
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onPin(); }}>
            Pinear
          </button>
          <div className="h-px bg-dark-border/30 my-1" />
          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onCsv(); }}>
            CSV
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onXlsx(); }}>
            Excel
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-dark-hover" onClick={() => { setOpen(false); onInsert(); }}>
            INSERT
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// Menú contextual para celdas
interface CellContextMenuProps {
  x: number;
  y: number;
  cell: CellValue;
  columnName: string;
  rowIndex: number;
  columnIndex: number;
  isEditMode: boolean;
  canEdit: boolean;
  onClose: () => void;
  onViewContent: () => void;
  onStartEdit: () => void;
  onDeleteRow: () => void;
}

function CellContextMenu({ 
  x, 
  y, 
  cell, 
  columnName, 
  isEditMode,
  canEdit,
  onClose, 
  onViewContent,
  onStartEdit,
  onDeleteRow
}: CellContextMenuProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatFullValue(cell));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 500);
  }, [cell, onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-50 bg-dark-surface/95 backdrop-blur-sm border border-dark-border/50 rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: x, top: y }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="px-3 py-1.5 text-xs text-dark-muted/70 border-b border-dark-border/30 mb-1">
          {columnName}
        </div>
        <button
          onClick={handleCopy}
          className="w-full px-3 py-1.5 text-left text-xs hover:bg-dark-hover/50 flex items-center gap-2 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-matrix-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Value'}
        </button>
        {isLongValue(cell) && (
          <button
            onClick={onViewContent}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-dark-hover/50 transition-colors"
          >
            View Full Content
          </button>
        )}
        {canEdit && isEditMode && (
          <>
            <div className="border-t border-dark-border/30 my-1" />
            <button
              onClick={onStartEdit}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-dark-hover/50 flex items-center gap-2 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Cell
            </button>
            <button
              onClick={onDeleteRow}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-red-900/30 text-accent-red flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Row
            </button>
          </>
        )}
      </motion.div>
    </>
  );
}

// Modal de confirmación para guardar cambios
interface ConfirmSaveModalProps {
  editedRowsCount: number;
  statements: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmSaveModal({ editedRowsCount, statements, onConfirm, onCancel }: ConfirmSaveModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
      onClick={onCancel}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-dark-surface border border-dark-border/50 rounded-lg shadow-2xl w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border/50 bg-dark-elevated/50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Confirm Changes</h2>
          </div>
          <button 
            onClick={onCancel} 
            className="btn btn-ghost p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
            <p className="text-sm text-yellow-200">
              You are about to update <span className="font-bold">{editedRowsCount}</span> row{editedRowsCount > 1 ? 's' : ''} in the database.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 text-dark-muted">SQL Statements to Execute:</h3>
            <div className="bg-dark-bg/50 border border-dark-border/30 rounded-lg p-3 max-h-[300px] overflow-auto">
              <pre className="text-xs font-mono text-dark-text whitespace-pre-wrap">
                {statements.join('\n\n')}
              </pre>
            </div>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              <strong>Note:</strong> These changes will be applied immediately and cannot be undone from this interface. 
              Make sure you have backups if needed.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-dark-border/50 bg-dark-elevated/50">
          <button
            onClick={onCancel}
            className="btn btn-ghost px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary px-4 py-2 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Confirm & Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Modal de confirmación para eliminar fila
interface ConfirmDeleteModalProps {
  statement: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDeleteModal({ statement, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" 
      onClick={onCancel}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-dark-surface border border-red-700/50 rounded-lg shadow-2xl w-[600px] max-w-[90vw] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-red-700/50 bg-red-900/20">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-red-400">Confirm Delete</h2>
          </div>
          <button 
            onClick={onCancel} 
            className="btn btn-ghost p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <p className="text-sm text-red-200">
              <strong>Warning:</strong> You are about to permanently delete this row from the database.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2 text-dark-muted">SQL Statement to Execute:</h3>
            <div className="bg-dark-bg/50 border border-dark-border/30 rounded-lg p-3">
              <pre className="text-xs font-mono text-dark-text whitespace-pre-wrap">
                {statement}
              </pre>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
            <p className="text-xs text-yellow-200">
              <strong>Note:</strong> This action cannot be undone. Make sure you have backups if needed.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-red-700/50 bg-red-900/10">
          <button
            onClick={onCancel}
            className="btn btn-ghost px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Confirm Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Componente para celda editable
interface EditableCellProps {
  value: CellValue;
  columnName: string;
  dataType: string;
  isEditing: boolean;
  isModified: boolean;
  onStartEdit: () => void;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  onOpenModal: () => void;
}

function EditableCell({ value, columnName, dataType, isEditing, isModified, onStartEdit, onSave, onCancel, onOpenModal }: EditableCellProps) {
  const [editValue, setEditValue] = useState(formatFullValue(value));

  useEffect(() => {
    if (isEditing) {
      setEditValue(formatFullValue(value));
    }
  }, [isEditing, value]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 min-w-[200px]">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(editValue);
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          onBlur={() => onSave(editValue)}
          autoFocus
          className="flex-1 bg-dark-surface border border-matrix-500 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-matrix-400"
        />
        <button
          onMouseDown={(e) => {
            // Prevent blur from input
            e.preventDefault();
            onOpenModal();
          }}
          className="p-1 hover:bg-dark-hover rounded text-dark-muted hover:text-matrix-400"
          title="Open Editor"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className={clsx(
        'truncate',
        isModified && 'text-matrix-400 font-semibold'
      )}
      onDoubleClick={onStartEdit}
    >
      {formatCellPreview(value)}
    </div>
  );
}

export function ResultsTable({ tab, hideMenu }: ResultsTableProps) {
  const { executeQuery } = useQueryStore();
  const { connections } = useConnectionStore();
  const { result, error, isExecuting, connectionId, query } = tab;
  
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cell: CellValue;
    columnName: string;
    rowIndex: number;
    columnIndex: number;
  } | null>(null);
  
  const [viewerContent, setViewerContent] = useState<{
    cell: CellValue;
    columnName: string;
  } | null>(null);

  // Estado para modal de edición
  const [editorModalContent, setEditorModalContent] = useState<{
    initialValue: string;
    columnName: string;
    dataType: string;
    rowIndex: number;
    columnIndex: number;
  } | null>(null);

  // Estado de edición
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedRows, setEditedRows] = useState<Map<number, Map<number, CellValue>>>(new Map());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [primaryKeyColumns, setPrimaryKeyColumns] = useState<string[]>([]);
  const [, setIsLoadingPrimaryKeys] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStatements, setPendingStatements] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteStatement, setPendingDeleteStatement] = useState<string>('');
  const [, setPendingDeleteRowIndex] = useState<number | null>(null);

  // Estado para filtro y ordenamiento local
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: number; direction: 'asc' | 'desc' } | null>(null);

  // Filas procesadas (filtradas y ordenadas) con su índice original
  const processedRows = useMemo(() => {
    if (!result) return [];
    
    // Mapear filas con su índice original para mantener la referencia de edición
    let rows = result.rows.map((row, index) => ({ row, index }));

    // 1. Filtrar
    if (filterText.trim()) {
      const lowerFilter = filterText.toLowerCase();
      rows = rows.filter(({ row }) => 
        row.some(cell => formatFullValue(cell).toLowerCase().includes(lowerFilter))
      );
    }

    // 2. Ordenar
    if (sortConfig) {
      rows.sort((a, b) => {
        const cellA = a.row[sortConfig.key];
        const cellB = b.row[sortConfig.key];
        
        const valA = cellValueToRaw(cellA);
        const valB = cellValueToRaw(cellB);

        if (valA === valB) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        const compareResult = valA < valB ? -1 : 1;
        return sortConfig.direction === 'asc' ? compareResult : -compareResult;
      });
    }

    return rows;
  }, [result, filterText, sortConfig]);

  const handleSort = (columnIndex: number) => {
    setSortConfig(current => {
      if (current?.key === columnIndex) {
        if (current.direction === 'asc') return { key: columnIndex, direction: 'desc' };
        return null;
      }
      return { key: columnIndex, direction: 'asc' };
    });
  };

  // Analizar si la query es editable
  const queryAnalysis = useMemo(() => {
    if (!query || !result) return null;
    return analyzeQueryEditability(query);
  }, [query, result]);

  // Cargar primary keys cuando la query es editable
  useEffect(() => {
    async function loadPrimaryKeys() {
      if (!queryAnalysis?.isEditable || !queryAnalysis.tableName || !connectionId) {
        setPrimaryKeyColumns([]);
        return;
      }

      setIsLoadingPrimaryKeys(true);
      try {
        const tableInfo = await schemaApi.getTableInfo(
          connectionId,
          queryAnalysis.tableName,
          queryAnalysis.schemaName || undefined
        );
        
        const pkColumns = tableInfo.primary_key?.columns || [];
        setPrimaryKeyColumns(pkColumns);
      } catch (err) {
        console.error('Failed to load primary keys:', err);
        setPrimaryKeyColumns([]);
      } finally {
        setIsLoadingPrimaryKeys(false);
      }
    }

    loadPrimaryKeys();
  }, [queryAnalysis, connectionId]);

  const canEdit = queryAnalysis?.isEditable && primaryKeyColumns.length > 0;

  // Obtener el engine de la conexión
  const connection = connections.find(c => c.id === connectionId);
  const engine = connection?.engine || 'postgresql';

  const [filters, setFilters] = useState<Array<{ column: string; operator: ComparisonOperator; value: string }>>([
    { column: '', operator: '=', value: '' },
  ]);
  const [groupOperator, setGroupOperator] = useState<'AND' | 'OR'>('AND');

  const addFilterRow = useCallback(() => {
    setFilters(prev => [...prev, { column: '', operator: '=', value: '' }]);
  }, []);

  const removeFilterRow = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateFilterRow = useCallback((index: number, patch: Partial<{ column: string; operator: ComparisonOperator; value: string }>) => {
    setFilters(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
  }, []);

  const quoteIdentifier = useCallback((name: string) => {
    switch (engine) {
      case 'mysql':
        return `\`${name}\``;
      case 'postgresql':
      case 'sqlite':
      default:
        return `"${name}"`;
    }
  }, [engine]);

  const formatTableName = useCallback((schema: string | null, table: string) => {
    if (schema) {
      return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    }
    return quoteIdentifier(table);
  }, [quoteIdentifier]);

  const parseValueByType = useCallback((value: string, dataType?: string): unknown => {
    const v = value.trim();
    if (v.length === 0) return null;
    const dt = (dataType || '').toLowerCase();
    if (dt.includes('int') || dt.includes('decimal') || dt.includes('numeric') || dt.includes('float') || dt.includes('double')) {
      const num = Number(v);
      return isNaN(num) ? v : num;
    }
    if (dt.includes('bool')) {
      const low = v.toLowerCase();
      return low === 'true' || low === '1' || low === 't';
    }
    return v;
  }, []);

  const buildWhereClause = useCallback(() => {
    if (!queryAnalysis?.tableName || !result) return '';
    const compiler = new QueryToSqlCompiler(engine);
    const group: ConditionGroup = {
      operator: groupOperator,
      conditions: [],
    };
    const tableNameForCols = queryAnalysis.tableName;
    filters.forEach((f) => {
      if (!f.column || !f.operator) return;
      const colInfo = result.columns.find(c => c.name === f.column);
      const cond: Condition = {
        column: { table: tableNameForCols, column: f.column },
        operator: f.operator,
      };
      if (f.operator === 'IS NULL' || f.operator === 'IS NOT NULL') {
      } else if (f.operator === 'IN') {
        const parts = f.value.split(',').map(s => s.trim()).filter(Boolean);
        (cond as any).values = parts.map(p => parseValueByType(p, colInfo?.data_type));
      } else {
        (cond as any).value = parseValueByType(f.value, colInfo?.data_type);
      }
      (group.conditions as any).push(cond);
    });
    if (group.conditions.length === 0) return '';
    const where = compiler.compileWhere(group);
    return where;
  }, [engine, groupOperator, filters, queryAnalysis, result, parseValueByType]);

  const applyFilters = useCallback(async () => {
    if (!result) return;
    const where = buildWhereClause();
    if (!where) return;
    const table = queryAnalysis?.tableName || null;
    const schema = queryAnalysis?.schemaName || null;
    if (!table) return;
    const full = formatTableName(schema, table);
    let baseLimit = '';
    const limitMatch = query.match(/LIMIT\s+\d+/i);
    if (limitMatch) {
      baseLimit = limitMatch[0];
    } else if (result.pagination?.page_size) {
      baseLimit = `LIMIT ${result.pagination.page_size}`;
    }
    const newSql = [`SELECT * FROM ${full}`, where, baseLimit].filter(Boolean).join('\n') + ';';
    await executeQuery(tab.id, newSql);
  }, [result, buildWhereClause, queryAnalysis, formatTableName, query, executeQuery, tab.id]);

  const handlePageChange = (page: number) => {
    executeQuery(tab.id, undefined, page, result?.pagination?.page_size || 50);
  };
  
  const handleExportCsv = useCallback(async () => {
    if (!result) return;
    const csv = toCsv(result);
    const filePath = await save({
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      defaultPath: 'query-results.csv',
    });
    if (!filePath) return;
    await writeTextFile(filePath as string, csv);
  }, [result]);

  const handleExportInsert = useCallback(async () => {
    if (!result) return;
    const sql = toInsertSql(result, engine, { schema: queryAnalysis?.schemaName || null, table: queryAnalysis?.tableName || null });
    const filePath = await save({
      filters: [{ name: 'SQL', extensions: ['sql'] }],
      defaultPath: 'insert-data.sql',
    });
    if (!filePath) return;
    await writeTextFile(filePath as string, sql);
  }, [result, engine, queryAnalysis]);

  const handleExportXlsx = useCallback(async () => {
    if (!result) return;
    const { columns, rows } = normalizeRowsForExcel(result);
    const filePath = await save({
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      defaultPath: 'query-results.xlsx',
    });
    if (!filePath) return;
    await exportApi.exportXlsx(columns, rows, filePath as string);
  }, [result]);

  const handleCellContextMenu = useCallback((
    e: React.MouseEvent,
    cell: CellValue,
    columnName: string,
    rowIndex: number,
    columnIndex: number
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, cell, columnName, rowIndex, columnIndex });
  }, []);

  const handleCellDoubleClick = useCallback((cell: CellValue, columnName: string) => {
    if (isLongValue(cell)) {
      setViewerContent({ cell, columnName });
    }
  }, []);

  // Funciones de edición
  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      // Salir del modo edición - descartar cambios
      setEditedRows(new Map());
      setEditingCell(null);
    }
    setIsEditMode(!isEditMode);
  }, [isEditMode]);

  const startEditingCell = useCallback((rowIndex: number, columnIndex: number) => {
    if (!isEditMode) return;
    setEditingCell({ rowIndex, columnIndex });
  }, [isEditMode]);

  const updateCellValue = useCallback((rowIndex: number, columnIndex: number, newValue: string) => {
    if (!result) return;

    const originalCell = result.rows[rowIndex][columnIndex];
    
    // Convertir el string a CellValue según el tipo de la columna
    let cellValue: CellValue;
    
    if (newValue.trim().toUpperCase() === 'NULL' || newValue.trim() === '') {
      cellValue = { type: 'Null' };
    } else if (originalCell.type === 'Bool') {
      const lower = newValue.toLowerCase();
      cellValue = { type: 'Bool', value: lower === 'true' || lower === '1' || lower === 't' };
    } else if (originalCell.type === 'Int') {
      const parsed = parseInt(newValue);
      cellValue = isNaN(parsed) ? originalCell : { type: 'Int', value: parsed };
    } else if (originalCell.type === 'Float') {
      const parsed = parseFloat(newValue);
      cellValue = isNaN(parsed) ? originalCell : { type: 'Float', value: parsed };
    } else if (originalCell.type === 'Json') {
      try {
        const parsed = JSON.parse(newValue);
        cellValue = { type: 'Json', value: parsed };
      } catch {
        cellValue = { type: 'String', value: newValue };
      }
    } else {
      cellValue = { type: 'String', value: newValue };
    }

    setEditedRows(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(rowIndex)) {
        newMap.set(rowIndex, new Map());
      }
      newMap.get(rowIndex)!.set(columnIndex, cellValue);
      return newMap;
    });
  }, [result]);

  const getCellValue = useCallback((rowIndex: number, columnIndex: number): CellValue => {
    const editedRow = editedRows.get(rowIndex);
    if (editedRow?.has(columnIndex)) {
      return editedRow.get(columnIndex)!;
    }
    return result?.rows[rowIndex][columnIndex] || { type: 'Null' };
  }, [editedRows, result]);

  const hasChanges = editedRows.size > 0;

  const prepareChanges = useCallback(() => {
    if (!result || !queryAnalysis || !canEdit) return;

    const statements: string[] = [];

    for (const [rowIndex, editedCells] of editedRows.entries()) {
      const originalRow = result.rows[rowIndex];
      
      // Construir Map de updates
      const updates = new Map<string, any>();
      for (const [colIndex, newValue] of editedCells.entries()) {
        const columnName = result.columns[colIndex].name;
        updates.set(columnName, cellValueToRaw(newValue));
      }

      // Construir Map de primary keys
      const primaryKeys = new Map<string, any>();
      for (const pkColumn of primaryKeyColumns) {
        const colIndex = result.columns.findIndex(c => c.name === pkColumn);
        if (colIndex >= 0) {
          primaryKeys.set(pkColumn, cellValueToRaw(originalRow[colIndex]));
        }
      }

      const updateStmt = generateUpdateStatement(
        queryAnalysis.tableName!,
        queryAnalysis.schemaName,
        updates,
        primaryKeys,
        engine
      );
      statements.push(updateStmt);
    }

    setPendingStatements(statements);
    setShowConfirmModal(true);
  }, [result, queryAnalysis, canEdit, editedRows, primaryKeyColumns, engine]);

  const saveChanges = useCallback(async () => {
    if (!result || !queryAnalysis || !canEdit) return;

    setShowConfirmModal(false);

    try {
      // Ejecutar todos los UPDATEs
      for (const stmt of pendingStatements) {
        await executeQuery(tab.id, stmt);
      }

      // Refrescar resultados
      await executeQuery(tab.id, query);
      
      // Limpiar estado de edición
      setEditedRows(new Map());
      setIsEditMode(false);
      setEditingCell(null);
      setPendingStatements([]);
    } catch (err) {
      console.error('Failed to save changes:', err);
      alert('Failed to save changes: ' + String(err));
    }
  }, [result, queryAnalysis, canEdit, pendingStatements, executeQuery, tab.id, query]);

  const deleteRow = useCallback(async (rowIndex: number) => {
    if (!result || !queryAnalysis || !canEdit) return;

    const originalRow = result.rows[rowIndex];
    
    // Construir Map de primary keys
    const primaryKeys = new Map<string, any>();
    for (const pkColumn of primaryKeyColumns) {
      const colIndex = result.columns.findIndex(c => c.name === pkColumn);
      if (colIndex >= 0) {
        primaryKeys.set(pkColumn, cellValueToRaw(originalRow[colIndex]));
      }
    }

    const deleteStmt = generateDeleteStatement(
      queryAnalysis.tableName!,
      queryAnalysis.schemaName,
      primaryKeys,
      engine
    );

    setPendingDeleteStatement(deleteStmt);
    setPendingDeleteRowIndex(rowIndex);
    setShowDeleteModal(true);
  }, [result, queryAnalysis, canEdit, primaryKeyColumns, engine]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteStatement) return;

    setShowDeleteModal(false);

    try {
      await executeQuery(tab.id, pendingDeleteStatement);
      
      // Refrescar resultados
      await executeQuery(tab.id, query);
      
      setPendingDeleteStatement('');
      setPendingDeleteRowIndex(null);
    } catch (err) {
      console.error('Failed to delete row:', err);
      alert('Failed to delete row: ' + String(err));
    }
  }, [pendingDeleteStatement, executeQuery, tab.id, query]);

  if (isExecuting) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg/50 text-dark-muted">
        <div className="text-center">
          <motion.div 
            className="w-8 h-8 border-2 border-matrix-500 border-t-transparent rounded-full mx-auto mb-2"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-sm">Executing query...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-dark-bg/50">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full"
        >
          <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-accent-red mb-2">Query Error</h3>
                <pre className="text-xs text-dark-text/90 font-mono bg-dark-surface/50 p-3 rounded border border-dark-border/30 whitespace-pre-wrap overflow-auto max-h-[200px]">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg/50 text-dark-muted/60">
        <p className="text-sm">Run a query to see results</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg/50">
      {/* Status bar - Más compacto */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-dark-border/30 bg-dark-surface/50 backdrop-blur-sm text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-dark-muted/80">
            <Rows3 className="w-3.5 h-3.5" />
            <span>{result.row_count} rows</span>
          </div>
          <div className="flex items-center gap-1 text-dark-muted/80">
            <Clock className="w-3.5 h-3.5" />
            <span>{result.execution_time_ms}ms</span>
          </div>
          {result.affected_rows !== undefined && (
            <span className="text-matrix-400 font-medium">
              {result.affected_rows} rows affected
            </span>
          )}
          {queryAnalysis && !queryAnalysis.isEditable && (
            <span className="text-dark-muted/60 text-[10px]">
              {queryAnalysis.reason}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!hideMenu && (
            <MenuActions
              onModal={() => {
                useResultPanelsStore.getState().ensurePanelFromResult({
                  id: tab.id,
                  query,
                  connectionId,
                  result: result!,
                });
                useResultPanelsStore.getState().setPanelState(tab.id, 'modal');
              }}
              onPin={() => {
                useResultPanelsStore.getState().ensurePanelFromResult({
                  id: tab.id,
                  query,
                  connectionId,
                  result: result!,
                });
                useResultPanelsStore.getState().setPanelState(tab.id, 'pinned');
              }}
              onCsv={handleExportCsv}
              onXlsx={handleExportXlsx}
              onInsert={handleExportInsert}
            />
          )}
          {canEdit && (
            <div className="flex items-center gap-2">
              {isEditMode && hasChanges && (
                <span className="text-matrix-400 text-[10px]">
                  {editedRows.size} row(s) modified
                </span>
              )}
              {isEditMode ? (
                <>
                  <button
                    onClick={prepareChanges}
                    disabled={!hasChanges}
                    className="btn btn-primary px-2 py-1 text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={toggleEditMode}
                    className="btn btn-ghost px-2 py-1 text-xs flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" />
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={toggleEditMode}
                  className="btn btn-secondary px-2 py-1 text-xs flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="px-3 py-2 border-b border-dark-border/30 bg-dark-surface/40">
          <div className="flex items-center gap-2 mb-2">
            <select
              value={groupOperator}
              onChange={(e) => setGroupOperator(e.target.value as 'AND' | 'OR')}
              className="bg-dark-surface border border-dark-border/50 rounded px-2 py-1 text-xs"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-dark-muted" />
              <input 
                type="text" 
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Buscar en resultados..."
                className="pl-7 pr-2 py-1 bg-dark-surface border border-dark-border/50 rounded text-xs focus:outline-none focus:border-matrix-500 w-48 transition-all focus:w-64"
              />
            </div>
            <div className="w-px h-4 bg-dark-border/30 mx-1" />

            <button
              onClick={addFilterRow}
              className="btn btn-secondary px-2 py-1 text-xs flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Filtro SQL
            </button>
            <button
              onClick={applyFilters}
              disabled={!queryAnalysis?.tableName}
              className="btn btn-primary px-2 py-1 text-xs flex items-center gap-1 disabled:opacity-50"
            >
              <Search className="w-3 h-3" />
              Aplicar filtros
            </button>
          </div>
          <div className="space-y-2">
            {filters.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={f.column}
                  onChange={(e) => updateFilterRow(idx, { column: e.target.value })}
                  className="bg-dark-surface border border-dark-border/50 rounded px-2 py-1 text-xs min-w-[160px]"
                >
                  <option value="">Columna</option>
                  {result.columns.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={f.operator}
                  onChange={(e) => updateFilterRow(idx, { operator: e.target.value as ComparisonOperator })}
                  className="bg-dark-surface border border-dark-border/50 rounded px-2 py-1 text-xs min-w-[120px]"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">&gt;=</option>
                  <option value="<=">&lt;=</option>
                  <option value="LIKE">LIKE</option>
                  <option value="IN">IN</option>
                  <option value="IS NULL">IS NULL</option>
                  <option value="IS NOT NULL">IS NOT NULL</option>
                </select>
                {f.operator !== 'IS NULL' && f.operator !== 'IS NOT NULL' && (
                  <input
                    type="text"
                    placeholder="Valor"
                    value={f.value}
                    onChange={(e) => updateFilterRow(idx, { value: e.target.value })}
                    className="flex-1 bg-dark-surface border border-dark-border/50 rounded px-2 py-1 text-xs"
                  />
                )}
                <button
                  onClick={() => removeFilterRow(idx)}
                  className="btn btn-ghost p-1"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-dark-surface/90 backdrop-blur-sm z-10">
            <tr>
              {result.columns.map((col, i) => {
                const isPrimaryKey = primaryKeyColumns.includes(col.name);
                return (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-semibold text-matrix-400/90 border-b border-dark-border/50 whitespace-nowrap cursor-pointer hover:bg-dark-surface/50 transition-colors select-none group"
                    onClick={() => handleSort(i)}
                  >
                    <div className="flex items-center gap-1.5">
                      {isPrimaryKey && <Key className="w-3 h-3 text-yellow-500" />}
                      {col.name}
                      <span className="text-[10px] text-dark-muted/60 font-normal">
                        {col.data_type}
                      </span>
                      {sortConfig?.key === i ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-matrix-500" /> : <ArrowDown className="w-3 h-3 text-matrix-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-dark-muted/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {processedRows.map(({ row, index: rowIdx }) => {
              const hasRowEdits = editedRows.has(rowIdx);
              return (
                <tr
                  key={rowIdx}
                  className={clsx(
                    'hover:bg-dark-surface/30 border-b border-dark-border/20 transition-colors',
                    hasRowEdits && 'bg-matrix-900/10'
                  )}
                >
                  {row.map((cell, cellIdx) => {
                    const columnName = result.columns[cellIdx]?.name || `Column ${cellIdx}`;
                    const isLong = isLongValue(cell);
                    const cellValue = getCellValue(rowIdx, cellIdx);
                    const isModified = editedRows.get(rowIdx)?.has(cellIdx) || false;
                    const isEditing = editingCell?.rowIndex === rowIdx && editingCell?.columnIndex === cellIdx;
                    
                    return (
                      <td
                        key={cellIdx}
                        className={clsx(
                          'px-3 py-1.5 font-mono max-w-[300px]',
                          cellValue.type === 'Null' && 'text-dark-muted/60 italic',
                          isLong && !isEditMode && 'cursor-pointer hover:bg-matrix-900/20',
                          isEditMode && 'cursor-pointer hover:bg-dark-surface/50'
                        )}
                        onContextMenu={(e) => handleCellContextMenu(e, cellValue, columnName, rowIdx, cellIdx)}
                        onDoubleClick={() => {
                          if (isEditMode) {
                            startEditingCell(rowIdx, cellIdx);
                          } else {
                            handleCellDoubleClick(cellValue, columnName);
                          }
                        }}
                        title={isLong && !isEditMode ? 'Double-click to view full content' : undefined}
                      >
                        {isEditMode ? (
                          <EditableCell
                            value={cellValue}
                            columnName={columnName}
                            dataType={result.columns[cellIdx]?.data_type || 'text'}
                            isEditing={isEditing}
                            isModified={isModified}
                            onStartEdit={() => startEditingCell(rowIdx, cellIdx)}
                            onSave={(newValue) => {
                              updateCellValue(rowIdx, cellIdx, newValue);
                              setEditingCell(null);
                            }}
                            onCancel={() => setEditingCell(null)}
                            onOpenModal={() => {
                              setEditorModalContent({
                                initialValue: formatFullValue(cellValue),
                                columnName,
                                dataType: result.columns[cellIdx]?.data_type || 'text',
                                rowIndex: rowIdx,
                                columnIndex: cellIdx,
                              });
                            }}
                          />
                        ) : (
                          <div className="truncate">
                            {formatCellPreview(cellValue)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {result.pagination && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-dark-border/30 bg-dark-surface/50 backdrop-blur-sm">
          <span className="text-xs text-dark-muted/70">
            Page {result.pagination.page} of {result.pagination.total_pages || '?'}
            {result.pagination.total_rows && ` (${result.pagination.total_rows} total)`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(result.pagination!.page - 1)}
              disabled={!result.pagination.has_previous}
              className="btn btn-ghost p-1 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(result.pagination!.page + 1)}
              disabled={!result.pagination.has_next}
              className="btn btn-ghost p-1 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Cell Context Menu */}
      {contextMenu && (
        <CellContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          cell={contextMenu.cell}
          columnName={contextMenu.columnName}
          rowIndex={contextMenu.rowIndex}
          columnIndex={contextMenu.columnIndex}
          isEditMode={isEditMode}
          canEdit={canEdit || false}
          onClose={() => setContextMenu(null)}
          onViewContent={() => {
            setViewerContent({ cell: contextMenu.cell, columnName: contextMenu.columnName });
            setContextMenu(null);
          }}
          onStartEdit={() => {
            startEditingCell(contextMenu.rowIndex, contextMenu.columnIndex);
            setContextMenu(null);
          }}
          onDeleteRow={() => {
            deleteRow(contextMenu.rowIndex);
            setContextMenu(null);
          }}
        />
      )}

      {/* Content Viewer Modal */}
      {viewerContent && (
        <ContentViewer
          value={viewerContent.cell}
          columnName={viewerContent.columnName}
          onClose={() => setViewerContent(null)}
        />
      )}

      {/* Editor Modal */}
      {editorModalContent && (
        <CellEditorModal
          initialValue={editorModalContent.initialValue}
          columnName={editorModalContent.columnName}
          dataType={editorModalContent.dataType}
          onClose={() => setEditorModalContent(null)}
          onSave={(newValue) => {
            updateCellValue(editorModalContent.rowIndex, editorModalContent.columnIndex, newValue);
            setEditorModalContent(null);
            setEditingCell(null);
          }}
        />
      )}

      {/* Confirm Save Modal */}
      {showConfirmModal && (
        <ConfirmSaveModal
          editedRowsCount={editedRows.size}
          statements={pendingStatements}
          onConfirm={saveChanges}
          onCancel={() => {
            setShowConfirmModal(false);
            setPendingStatements([]);
          }}
        />
      )}

      {/* Confirm Delete Modal */}
      {showDeleteModal && (
        <ConfirmDeleteModal
          statement={pendingDeleteStatement}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteModal(false);
            setPendingDeleteStatement('');
            setPendingDeleteRowIndex(null);
          }}
        />
      )}
    </div>
  );
}
