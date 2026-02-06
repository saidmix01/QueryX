import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table,
  Eye,
  Key,
  Hash,
  Folder,
  FolderOpen,
  Zap,
  Link,
  Code,
  ListOrdered,
  Loader2,
} from 'lucide-react';
import { useUIStore } from '../store/ui-store';
import clsx from 'clsx';
import { useExplorerStore, TreeNode, TreeNodeType } from '../store/explorer-store';
import { useConnectionStore } from '../store/connection-store';
import { useQueryStore } from '../store/query-store';
import { useSchemaStore } from '../store/schema-store';
import { ContextMenu } from './ContextMenu';
import type { DatabaseEngine, Connection, CellValue } from '../domain/types';
import { queryApi } from '../infrastructure/tauri-api';
import { ensureDefaultSchemaInitialized } from '../utils/schema-init';
import { AdminAdapterFactory } from '../infrastructure/admin-adapters';

interface FlattenedNode {
  node: TreeNode;
  depth: number;
}

const NODE_HEIGHT = 28;

const engineIcons: Record<string, string> = {
  postgresql: '🐘',
  mysql: '🐬',
  sqlite: '📦',
};

// Helper para extraer valor de CellValue
const getCellValue = (cell: CellValue | undefined): any => {
  if (!cell || cell.type === 'Null') return null;
  return (cell as any).value;
};

// Helper para generar identificadores SQL según el motor
function quoteIdentifier(name: string, engine: DatabaseEngine): string {
  switch (engine) {
    case 'mysql':
      return `\`${name}\``;
    case 'postgresql':
      return `"${name}"`;
    case 'sqlite':
      return `"${name}"`;
    default:
      return `"${name}"`;
  }
}

function formatTableName(schema: string | undefined, table: string, engine: DatabaseEngine): string {
  const quotedTable = quoteIdentifier(table, engine);
  if (schema) {
    return `${quoteIdentifier(schema, engine)}.${quotedTable}`;
  }
  return quotedTable;
}

function NodeIcon({ type, isExpanded, metadata, isActiveContext }: { type: TreeNodeType; isExpanded: boolean; metadata?: Record<string, unknown>; isActiveContext?: boolean }): JSX.Element {
  const iconClass = 'w-4 h-4 flex-shrink-0';
  
  switch (type) {
    case 'connection':
      const status = metadata?.status as string;
      const engine = (metadata?.engine as string) || 'postgresql';
      const icon = engineIcons[engine] || '🐘';

      return (
        <div className="flex items-center gap-1.5 mr-1">
          <div
            className={clsx(
              'w-2 h-2 rounded-full',
              status === 'Connected'
                ? 'bg-green-500'
                : status === 'Connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-gray-500'
            )}
          />
          <span className="text-xs grayscale-[0.5]">{icon}</span>
        </div>
      );
    case 'database':
      return <Database className={clsx(iconClass, isActiveContext ? 'text-matrix-400 font-bold' : 'text-blue-400')} />;
    case 'schema':
      return isExpanded 
        ? <FolderOpen className={clsx(iconClass, 'text-yellow-400')} />
        : <Folder className={clsx(iconClass, 'text-yellow-400')} />;
    case 'tables-folder':
    case 'views-folder':
    case 'functions-folder':
    case 'sequences-folder':
    case 'columns-folder':
    case 'indexes-folder':
    case 'constraints-folder':
    case 'triggers-folder':
      return isExpanded 
        ? <FolderOpen className={clsx(iconClass, 'text-dark-muted')} />
        : <Folder className={clsx(iconClass, 'text-dark-muted')} />;
    case 'table':
      return <Table className={clsx(iconClass, 'text-blue-300')} />;
    case 'view':
      return <Eye className={clsx(iconClass, 'text-purple-400')} />;
    case 'column':
      const isPK = metadata?.is_primary_key;
      return isPK 
        ? <Key className={clsx(iconClass, 'text-yellow-500')} />
        : <Hash className={clsx(iconClass, 'text-dark-muted')} />;
    case 'index':
      return <ListOrdered className={clsx(iconClass, 'text-orange-400')} />;
    case 'constraint':
      return <Link className={clsx(iconClass, 'text-red-400')} />;
    case 'trigger':
      return <Zap className={clsx(iconClass, 'text-yellow-400')} />;
    case 'function':
      return <Code className={clsx(iconClass, 'text-green-400')} />;
    case 'sequence':
      return <ListOrdered className={clsx(iconClass, 'text-cyan-400')} />;
    default:
      return <Folder className={iconClass} />;
  }
}

const getNodeLabel = (node: TreeNode): string => {
  if (node.type === 'column') {
    const dataType = node.metadata?.data_type as string;
    return `${node.name} (${dataType})`;
  }
  return node.name;
};

interface TreeNodeRowProps {
  flatNode: FlattenedNode;
  isSelected: boolean;
  isActiveContext?: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

function TreeNodeRow({
  flatNode,
  isSelected,
  isActiveContext,
  onToggle,
  onSelect,
  onContextMenu,
  onDoubleClick,
}: TreeNodeRowProps): JSX.Element {
  const node: TreeNode = flatNode.node;
  const depth = flatNode.depth;

  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-2 cursor-pointer hover:bg-dark-bg rounded select-none',
        isSelected && 'bg-primary-900/30 hover:bg-primary-900/40'
      )}
      style={{ 
        height: NODE_HEIGHT, 
        paddingLeft: depth * 12 + 4,
      }}
      onClick={() => {
        onSelect();
        // Also toggle if expandable
        if (node.isExpandable) {
          onToggle();
        }
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Expand/Collapse button */}
      {node.isExpandable ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-1 hover:bg-dark-border rounded flex-shrink-0"
        >
          {node.isLoading ? (
            <Loader2 className="w-4 h-4 text-dark-muted animate-spin" />
          ) : node.isExpanded ? (
            <ChevronDown className="w-4 h-4 text-dark-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-dark-muted" />
          )}
        </button>
      ) : (
        <span className="w-5" />
      )}

      {/* Icon */}
      <NodeIcon type={node.type} isExpanded={node.isExpanded} metadata={node.metadata} isActiveContext={isActiveContext} />

      {/* Label */}
      <span className={clsx(
        'text-sm truncate flex-1',
        node.type === 'column' && (node.metadata?.is_primary_key as boolean) && 'text-yellow-500',
        isActiveContext && 'font-bold text-matrix-400'
      )}>
        {getNodeLabel(node)}
        {isActiveContext && <span className="ml-2 text-xs bg-matrix-500/20 text-matrix-400 px-1 rounded">Active</span>}
      </span>

      {/* Nullable indicator for columns */}
      {node.type === 'column' && (node.metadata?.nullable as boolean) && (
        <span className="text-xs text-dark-muted opacity-60">NULL</span>
      )}
    </div>
  );
}

export function DatabaseTree() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);

  const {
    nodes,
    rootNodes,
    selectedNodeId,
    toggleNode,
    selectNode,
    refreshNode,
    syncConnections,
  } = useExplorerStore();

  const { 
    connections, 
    activeConnectionId, 
    connectionStatuses,
    activeContexts, 
    connect, 
    disconnect, 
    deleteConnection, 
    setActiveConnection,
    updateConnection
  } = useConnectionStore();
  
  const { addTab, setActiveTab, executeQuery } = useQueryStore();
  const { setSelectedSchema, setSelectedDatabase, clear: clearSchema } = useSchemaStore();
  const { openConnectionModal } = useUIStore();

  // Sync connections to explorer tree
  useEffect(() => {
    syncConnections(connections, connectionStatuses);
  }, [connections, connectionStatuses, syncConnections]);

  // Flatten tree for virtualization
  const flattenedNodes = useMemo(() => {
    const result: FlattenedNode[] = [];

    const flatten = (nodeIds: string[], depth: number) => {
      for (const nodeId of nodeIds) {
        const node = nodes[nodeId];
        if (!node) continue;

        result.push({ node, depth });

        if (node.isExpanded && node.children.length > 0) {
          flatten(node.children, depth + 1);
        }
      }
    };

    flatten(rootNodes, 0);
    return result;
  }, [nodes, rootNodes]);

  const virtualizer = useVirtualizer({
    count: flattenedNodes.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => NODE_HEIGHT,
    overscan: 10,
  });

  const handleToggle = useCallback(
    async (nodeId: string) => {
      const node = nodes[nodeId];
      if (!node) {
        return;
      }

      if (node.type === 'connection') {
        const connectionId = node.metadata?.connectionId as string;
        const status = node.metadata?.status as string;

        setActiveConnection(connectionId);

        if (status !== 'Connected') {
          try {
            await connect(connectionId);
          } catch (e) {
            console.error(e);
            return;
          }
        }
        await toggleNode(nodeId, connectionId);
        return;
      }
      
      // Get connectionId from metadata, falling back to activeConnectionId
      let connectionId = node.metadata?.connectionId as string;
      if (!connectionId) {
        connectionId = activeConnectionId || '';
      }
      
      if (connectionId) {
        if (activeConnectionId !== connectionId) {
          const conn = connections.find(c => c.id === connectionId);
          if (conn) {
            setActiveConnection(connectionId);
            clearSchema(connectionId);
            await ensureDefaultSchemaInitialized(conn);
          }
        }
        
        if (node.type === 'database') {
          const db = node.metadata?.database as string;
          if (db) {
            try {
              // Use changeDatabase instead of updateConnection to switch context at runtime
              const { changeDatabase } = useConnectionStore.getState();
              await changeDatabase(connectionId, db);
              setSelectedDatabase(connectionId, db);
              
              // Only ensure schema init if we successfully switched
              const conn = connections.find(c => c.id === connectionId);
              if (conn) {
                await ensureDefaultSchemaInitialized({ ...conn, database: db } as Connection, { force: true });
              }
            } catch (e) {
              console.error('Failed to change database context:', e);
              // Optionally show a toast error here
            }
          }
        }
        
        await toggleNode(nodeId, connectionId);
        
        // Si se expandió una carpeta de tablas, cargar las tablas en el schema store
        if (node.type === 'tables-folder' && node.isExpanded === false) {
          const schema = node.metadata?.schema as string;
          if (schema) {
            setSelectedSchema(connectionId, schema);
          }
        }
      } else {
        return;
      }
    },
    [nodes, activeConnectionId, toggleNode, setSelectedSchema]
  );

  const handleDoubleClick = useCallback(
    (node: TreeNode) => {
      if (node.type === 'table' || node.type === 'view') {
        const schema = node.metadata?.schema as string;
        const tableName = node.name;
        const connectionId = node.metadata?.connectionId as string;
        
        // Obtener el engine de la conexión
        const connection = connections.find(c => c.id === connectionId);
        const engine = connection?.engine || 'postgresql';
        
        // Generar SELECT con el delimitador correcto
        const fullTableName = formatTableName(schema, tableName, engine);
        const query = `SELECT * FROM ${fullTableName} LIMIT 100;`;
        
        const tabId = addTab({
          title: tableName,
          query,
          connectionId,
        });
        setActiveTab(tabId);
        executeQuery(tabId, query);
      }
    },
    [addTab, setActiveTab, executeQuery, connections]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: TreeNode) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        node,
      });
    },
    []
  );

  const getContextMenuItems = useCallback(
    (node: TreeNode) => {
      const items: Array<{
        label: string;
        action: () => void;
        danger?: boolean;
        separator?: boolean;
      }> = [];

      const connectionId = node.metadata?.connectionId as string;
      const schema = node.metadata?.schema as string;
      
      if (node.type === 'connection') {
        const status = node.metadata?.status as string;
        if (status === 'Connected') {
            items.push({
                label: 'Disconnect',
                action: () => disconnect(connectionId)
            });
            items.push({
                label: 'Refresh',
                action: () => refreshNode(node.id, connectionId)
            });
        } else {
            items.push({
                label: 'Connect',
                action: () => connect(connectionId)
            });
        }
        items.push({ separator: true, label: '', action: () => {} });
        items.push({
            label: 'Edit Connection',
            action: () => openConnectionModal(connectionId)
        });
        items.push({
            label: 'Delete Connection',
            danger: true,
            action: async () => {
                if (confirm('Are you sure you want to delete this connection?')) {
                    await deleteConnection(connectionId);
                }
            }
        });
        return items;
      }

      // Obtener el engine de la conexión
      const connection = connections.find(c => c.id === connectionId);
      const engine = connection?.engine || 'postgresql';

      if (node.type === 'users-folder') {
        items.push(
          {
            label: 'Create User',
            action: () => {
              const tabId = addTab({
                type: 'admin',
                title: 'New User',
                connectionId,
                adminState: {
                  type: 'user',
                  mode: 'create',
                  engine,
                  initialDefinition: { name: '', roles: [] },
                },
              });
              setActiveTab(tabId);
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'Refresh',
            action: () => {
              if (connectionId) {
                refreshNode(node.id, connectionId);
              }
            },
          }
        );
        return items;
      }

      if (node.type === 'user') {
        items.push(
          {
            label: 'Edit User',
            action: async () => {
              try {
                const adapter = AdminAdapterFactory.getAdapter(engine);
                const executor = async (sql: string) => {
                  const res = await queryApi.execute(connectionId, sql);
                  if (!res.rows) return [];
                  return res.rows.map(row => {
                    const obj: Record<string, any> = {};
                    res.columns.forEach((col, i) => {
                      obj[col.name] = getCellValue(row[i]);
                    });
                    return obj;
                  });
                };
                const definition = await adapter.getUserDefinition(node.name, executor);
                
                const tabId = addTab({
                  type: 'admin',
                  title: `Edit ${node.name}`,
                  connectionId,
                  adminState: {
                    type: 'user',
                    mode: 'edit',
                    engine,
                    initialDefinition: definition,
                  },
                });
                setActiveTab(tabId);
              } catch (error) {
                console.error('Failed to load user definition:', error);
              }
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'Drop User',
            action: () => {
              // TODO: Confirmation and SQL Preview via Admin Modal?
              // For now simple SQL execution or tab
              const adapter = AdminAdapterFactory.getAdapter(engine);
              const sql = adapter.getDropUserSQL(node.name);
              const tabId = addTab({ title: `DROP ${node.name}`, query: sql, connectionId });
              setActiveTab(tabId);
            },
            danger: true,
          }
        );
        return items;
      }

      if (node.type === 'roles-folder') {
        items.push(
          {
            label: 'Create Role',
            action: () => {
              const adapter = AdminAdapterFactory.getAdapter(engine);
              const sql = adapter.getCreateRoleSQL({ name: 'new_role' });
              const tabId = addTab({ title: 'New Role', query: sql, connectionId });
              setActiveTab(tabId);
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'Refresh',
            action: () => {
              if (connectionId) {
                refreshNode(node.id, connectionId);
              }
            },
          }
        );
        return items;
      }

      if (node.type === 'role') {
        items.push(
          {
            label: 'Drop Role',
            action: () => {
              const adapter = AdminAdapterFactory.getAdapter(engine);
              const sql = adapter.getDropRoleSQL(node.name);
              const tabId = addTab({ title: `DROP ${node.name}`, query: sql, connectionId });
              setActiveTab(tabId);
            },
            danger: true,
          }
        );
        return items;
      }

      if (node.type === 'tables-folder') {
        items.push(
          {
            label: 'Create Table',
            action: () => {
              const tabId = addTab({
                type: 'admin',
                title: 'New Table',
                connectionId,
                adminState: {
                  type: 'table',
                  mode: 'create',
                  engine,
                  schema: node.metadata?.schema as string,
                },
              });
              setActiveTab(tabId);
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'Refresh',
            action: () => {
              if (connectionId) {
                refreshNode(node.id, connectionId);
              }
            },
          }
        );
        return items;
      }

      if (node.type === 'table') {
        const fullTableName = formatTableName(schema, node.name, engine);
        
        items.push(
          {
            label: 'View Data',
            action: () => handleDoubleClick(node),
          },
          {
            label: 'Edit Structure',
            action: async () => {
              try {
                const adapter = AdminAdapterFactory.getAdapter(engine);
                const executor = async (sql: string) => {
                  const res = await queryApi.execute(connectionId, sql);
                  if (!res.rows) return [];
                  return res.rows.map(row => {
                    const obj: Record<string, any> = {};
                    res.columns.forEach((col, i) => {
                      obj[col.name] = getCellValue(row[i]);
                    });
                    return obj;
                  });
                };
                const definition = await adapter.getTableDefinition(schema, node.name, executor);
                
                const tabId = addTab({
                  type: 'admin',
                  title: `Edit ${node.name}`,
                  connectionId,
                  adminState: {
                    type: 'table',
                    mode: 'edit',
                    engine,
                    initialDefinition: definition,
                    schema,
                    table: node.name,
                  },
                });
                setActiveTab(tabId);
              } catch (error) {
                console.error('Failed to load table definition:', error);
                // Could use a toast notification here
              }
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'Generate SELECT',
            action: () => {
              const query = `SELECT * FROM ${fullTableName};`;
              const tabId = addTab({ title: `SELECT ${node.name}`, query, connectionId });
              setActiveTab(tabId);
            },
          },
          {
            label: 'Generate INSERT',
            action: () => {
              const query = `INSERT INTO ${fullTableName} (column1, column2)\nVALUES (value1, value2);`;
              const tabId = addTab({ title: `INSERT ${node.name}`, query, connectionId });
              setActiveTab(tabId);
            },
          },
          {
            label: 'Copy Name',
            action: () => {
              navigator.clipboard.writeText(fullTableName);
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'Refresh',
            action: () => {
              if (connectionId) {
                refreshNode(node.id, connectionId);
              }
            },
          },
          { label: '', action: () => {}, separator: true },
          {
            label: 'TRUNCATE Table',
            action: () => {
              // TODO: Mostrar confirmación
              const query = `TRUNCATE TABLE ${fullTableName};`;
              const tabId = addTab({ title: `TRUNCATE ${node.name}`, query, connectionId });
              setActiveTab(tabId);
            },
            danger: true,
          },
          {
            label: 'DROP Table',
            action: () => {
              // TODO: Mostrar confirmación
              const query = `DROP TABLE ${fullTableName};`;
              const tabId = addTab({ title: `DROP ${node.name}`, query, connectionId });
              setActiveTab(tabId);
            },
            danger: true,
          }
        );
      } else if (node.type === 'view') {
        const fullViewName = formatTableName(schema, node.name, engine);
        items.push(
          {
            label: 'View Data',
            action: () => handleDoubleClick(node),
          },
          {
            label: 'Copy Name',
            action: () => {
              navigator.clipboard.writeText(fullViewName);
            },
          }
        );
      } else if (node.type === 'column') {
        items.push({
          label: 'Copy Name',
          action: () => {
            navigator.clipboard.writeText(quoteIdentifier(node.name, engine));
          },
        });
      } else if (node.isExpandable) {
        items.push({
          label: 'Refresh',
          action: () => {
            if (connectionId) {
              refreshNode(node.id, connectionId);
            }
          },
        });
      }

      return items;
    },
    [handleDoubleClick, addTab, setActiveTab, refreshNode, connections]
  );

  if (flattenedNodes.length === 0) {
    return (
      <div className="p-4 text-center text-dark-muted text-sm">
        Connect to a database to explore
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const flatNode = flattenedNodes[virtualRow.index];
            const connectionId = flatNode.node.metadata?.connectionId as string;
            const context = activeContexts[connectionId];
            
            // Check if this database node is the active one
            // We use case-insensitive comparison for better UX as some DBs return lowercase
            const isActiveContext = 
                flatNode.node.type === 'database' && 
                context?.database?.toLowerCase() === flatNode.node.name.toLowerCase();

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <TreeNodeRow
                  flatNode={flatNode}
                  isSelected={selectedNodeId === flatNode.node.id}
                  isActiveContext={isActiveContext}
                  onToggle={() => handleToggle(flatNode.node.id)}
                  onSelect={() => selectNode(flatNode.node.id)}
                  onContextMenu={(e) => handleContextMenu(e, flatNode.node)}
                  onDoubleClick={() => handleDoubleClick(flatNode.node)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
