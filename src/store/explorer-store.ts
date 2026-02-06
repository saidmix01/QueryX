import { create } from 'zustand';
import { schemaApi, queryApi } from '../infrastructure/tauri-api';
import { AdminAdapterFactory } from '../infrastructure/admin-adapters';
import { schemaCatalog } from '../sql-completion/schema-catalog';
import { DatabaseEngine, CellValue, ConnectionStatus } from '../domain/types';

// Helper to extract value from CellValue
const getCellValue = (cell: CellValue | undefined): any => {
  if (!cell || cell.type === 'Null') return null;
  return (cell as any).value;
};

// Tipos de nodos del árbol
export type TreeNodeType =
  | 'connection'
  | 'database'
  | 'schema'
  | 'tables-folder'
  | 'table'
  | 'columns-folder'
  | 'column'
  | 'indexes-folder'
  | 'index'
  | 'constraints-folder'
  | 'constraint'
  | 'triggers-folder'
  | 'trigger'
  | 'views-folder'
  | 'view'
  | 'functions-folder'
  | 'function'
  | 'sequences-folder'
  | 'sequence'
  | 'users-folder'
  | 'user'
  | 'roles-folder'
  | 'role';

export interface TreeNode {
  id: string;
  type: TreeNodeType;
  name: string;
  parentId: string | null;
  isExpandable: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  isLoaded: boolean;
  children: string[];
  metadata?: Record<string, unknown>;
}

interface ExplorerState {
  nodes: Record<string, TreeNode>;
  rootNodes: string[];
  selectedNodeId: string | null;
  expandedNodes: Set<string>;
  loadingNodes: Set<string>;
  showSystemSchemas: boolean;
  cache: Map<string, { data: unknown; timestamp: number }>;
  cacheTimeout: number;

  // Actions
  initializeConnection: (connectionId: string, connectionName: string, database?: string) => void;
  syncConnections: (connections: { id: string; name: string; database?: string; engine?: string }[], statuses: Record<string, ConnectionStatus>) => void;
  toggleNode: (nodeId: string, connectionId: string) => Promise<void>;
  selectNode: (nodeId: string) => void;
  loadChildren: (nodeId: string, connectionId: string) => Promise<void>;
  refreshNode: (nodeId: string, connectionId: string) => Promise<void>;
  setShowSystemSchemas: (show: boolean) => void;
  clearCache: () => void;
  removeConnection: (connectionId: string) => void;
  getNodePath: (nodeId: string) => TreeNode[];
}

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

const createNodeId = (type: TreeNodeType, ...parts: string[]): string => {
  return `${type}:${parts.join(':')}`;
};

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  nodes: {},
  rootNodes: [],
  selectedNodeId: null,
  expandedNodes: new Set(),
  loadingNodes: new Set(),
  showSystemSchemas: false,
  cache: new Map(),
  cacheTimeout: CACHE_TIMEOUT,

  initializeConnection: (connectionId, connectionName, database) => {
    const connNodeId = createNodeId('connection', connectionId);

    console.log('[Explorer] initializeConnection:', { connectionId, connectionName, database, connNodeId });

    set((state) => {
      const newNodes = { ...state.nodes };
      
      // Siempre inicializamos la conexión como no cargada para forzar listado de DBs
      newNodes[connNodeId] = {
        id: connNodeId,
        type: 'connection',
        name: connectionName,
        parentId: null,
        isExpandable: true,
        isExpanded: false,
        isLoading: false,
        isLoaded: false, 
        children: [],
        metadata: { connectionId, database: database || null },
      };

      const rootNodes = state.rootNodes.includes(connNodeId)
        ? state.rootNodes
        : [...state.rootNodes, connNodeId];

      console.log('[Explorer] New state:', { newNodes, rootNodes });

      return { nodes: newNodes, rootNodes };
    });
  },

  syncConnections: (connections, statuses) => {
    set((state) => {
      const newNodes = { ...state.nodes };
      const newRootNodes = connections.map(c => createNodeId('connection', c.id));
      let stateChanged = false;

      // Check if rootNodes changed
      if (JSON.stringify(newRootNodes) !== JSON.stringify(state.rootNodes)) {
        stateChanged = true;
      }

      connections.forEach(conn => {
        const nodeId = createNodeId('connection', conn.id);
        const rawStatus = statuses[conn.id] || 'Disconnected';
        const status = typeof rawStatus === 'string' ? rawStatus : 'Error'; 
        
        const isConnected = status === 'Connected';
        const existingNode = newNodes[nodeId];

        // Prepare metadata
        const metadata = { 
          connectionId: conn.id, 
          database: conn.database, 
          status, 
          engine: conn.engine 
        };

        if (existingNode) {
          // Check for changes to avoid unnecessary updates
          const currentStatus = existingNode.metadata?.status;
          const currentName = existingNode.name;
          
          if (currentStatus !== status || currentName !== conn.name) {
             stateChanged = true;
             newNodes[nodeId] = {
               ...existingNode,
               name: conn.name,
               metadata: { ...existingNode.metadata, ...metadata },
             };
          }

          // Si pasamos a Connected y no está cargado, no hacemos nada especial aquí.
          // Dejamos que el usuario expanda el nodo, lo cual disparará loadChildren -> listDatabases.
          // Si pasamos a Disconnected, limpiamos.
          if (!isConnected && existingNode.children.length > 0) {
              // Connected -> Disconnected: Clear children and collapse
              newNodes[nodeId].children = [];
              newNodes[nodeId].isExpanded = false;
              newNodes[nodeId].isLoaded = false;
              stateChanged = true;
          }
        } else {
          stateChanged = true;
          // Create new node
          newNodes[nodeId] = {
            id: nodeId,
            type: 'connection',
            name: conn.name,
            parentId: null,
            isExpandable: true,
            isExpanded: false,
            isLoading: false,
            isLoaded: false, // Siempre false al inicio
            children: [],
            metadata,
          };
        }
      });

      if (!stateChanged) return state;

      return { nodes: newNodes, rootNodes: newRootNodes };
    });
  },

  toggleNode: async (nodeId, connectionId) => {
    const { nodes, loadChildren } = get();
    const node = nodes[nodeId];
    if (!node) {
      console.warn('[Explorer] toggleNode: node not found:', nodeId);
      return;
    }

    console.log('[Explorer] toggleNode:', { 
      nodeId, 
      connectionId, 
      nodeType: node.type, 
      isExpanded: node.isExpanded, 
      isLoaded: node.isLoaded,
      isExpandable: node.isExpandable 
    });

    if (node.isExpanded) {
      set((state) => {
        const expandedNodes = new Set(state.expandedNodes);
        expandedNodes.delete(nodeId);
        return {
          nodes: {
            ...state.nodes,
            [nodeId]: { ...node, isExpanded: false },
          },
          expandedNodes,
        };
      });
    } else {
      if (!node.isLoaded && node.isExpandable) {
        console.log('[Explorer] toggleNode: calling loadChildren');
        await loadChildren(nodeId, connectionId);
      } else {
        console.log('[Explorer] toggleNode: skipping loadChildren (isLoaded:', node.isLoaded, ', isExpandable:', node.isExpandable, ')');
      }
      set((state) => {
        const expandedNodes = new Set(state.expandedNodes);
        expandedNodes.add(nodeId);
        return {
          nodes: {
            ...state.nodes,
            [nodeId]: { ...state.nodes[nodeId], isExpanded: true },
          },
          expandedNodes,
        };
      });

      // Auto-expansion logic
      const { nodes: currentNodes, toggleNode } = get();
      const updatedNode = currentNodes[nodeId];
      if (!updatedNode) return;

      const expandChild = async (childId: string) => {
        const child = get().nodes[childId];
        if (child && !child.isExpanded) {
          await toggleNode(childId, connectionId);
        }
      };
      
      // Auto-expand database if it matches the default one
      if (updatedNode.type === 'connection') {
          const defaultDb = updatedNode.metadata?.database as string;
          if (defaultDb) {
              const dbChildId = updatedNode.children.find(id => {
                  const child = get().nodes[id];
                  // Comparación insensible a mayúsculas
                  return child && child.name.toLowerCase() === defaultDb.toLowerCase();
              });
              if (dbChildId) {
                  await expandChild(dbChildId);
              }
          }
      } else if (updatedNode.type === 'database') {
        // Database -> 'public' Schema or Single Schema
        const children = updatedNode.children.map(id => get().nodes[id]).filter(Boolean);
        const publicSchema = children.find(c => c.type === 'schema' && c.name === 'public');
        const singleSchema = children.length === 1 && children[0].type === 'schema' ? children[0] : null;
        
        const targetSchema = publicSchema || singleSchema;
        if (targetSchema) {
            await expandChild(targetSchema.id);
        }
      } else if (updatedNode.type === 'schema') {
        // Schema -> Tables Folder
        const tablesFolderId = updatedNode.children.find(id => {
            const child = get().nodes[id];
            return child && child.type === 'tables-folder';
        });
        if (tablesFolderId) {
            await expandChild(tablesFolderId);
        }
      }
    }
  },

  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  loadChildren: async (nodeId, connectionId) => {
    const { nodes, showSystemSchemas, cache, cacheTimeout } = get();
    const node = nodes[nodeId];
    if (!node || node.isLoading) return;

    console.log('[Explorer] loadChildren called:', { nodeId, connectionId, nodeType: node.type, metadata: node.metadata });

    // Check cache
    const cacheKey = `${nodeId}:${connectionId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      console.log('[Explorer] Using cached data for:', nodeId);
      return;
    }

    set((state) => ({
      nodes: { ...state.nodes, [nodeId]: { ...node, isLoading: true } },
      loadingNodes: new Set(state.loadingNodes).add(nodeId),
    }));

    try {
      const newNodes: Record<string, TreeNode> = {};
      const childIds: string[] = [];

      switch (node.type) {
        case 'connection': {
          // SIEMPRE cargamos la lista de databases
          console.log('[Explorer] Loading databases for connection:', { connectionId });
          const databases = await schemaApi.listDatabases(connectionId);
          console.log('[Explorer] Databases loaded:', databases);
          
          for (const dbName of databases) {
            const dbNodeId = createNodeId('database', connectionId, dbName);
            childIds.push(dbNodeId);
            newNodes[dbNodeId] = {
              id: dbNodeId,
              type: 'database',
              name: dbName,
              parentId: nodeId,
              isExpandable: true,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
              metadata: { connectionId, database: dbName },
            };
          }
          break;
        }

        case 'database': {
          const database = node.metadata?.database as string;
          const engine = node.metadata?.engine as DatabaseEngine;
          console.log('[Explorer] Loading children for database:', { connectionId, database, engine });
          
          // 1. Load Schemas
          const schemas = await schemaApi.listSchemas(connectionId, database);
          console.log('[Explorer] Schemas loaded:', schemas);
          
          for (const schema of schemas) {
            if (!showSystemSchemas && schema.is_system) continue;
            
            const schemaNodeId = createNodeId('schema', connectionId, database, schema.name);
            childIds.push(schemaNodeId);
            newNodes[schemaNodeId] = {
              id: schemaNodeId,
              type: 'schema',
              name: schema.name,
              parentId: nodeId,
              isExpandable: true,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
              metadata: { connectionId, database, schema: schema.name, isSystem: schema.is_system },
            };
          }

          // 2. Load Users and Roles folders if supported
          if (engine) {
            try {
              const adapter = AdminAdapterFactory.getAdapter(engine);
              
              if (adapter.features.users) {
                const usersId = createNodeId('users-folder', connectionId, database);
                childIds.push(usersId);
                newNodes[usersId] = {
                  id: usersId,
                  type: 'users-folder',
                  name: 'Users',
                  parentId: nodeId,
                  isExpandable: true,
                  isExpanded: false,
                  isLoading: false,
                  isLoaded: false,
                  children: [],
                  metadata: { connectionId, database, engine },
                };
              }

              if (adapter.features.roles) {
                const rolesId = createNodeId('roles-folder', connectionId, database);
                childIds.push(rolesId);
                newNodes[rolesId] = {
                  id: rolesId,
                  type: 'roles-folder',
                  name: 'Roles',
                  parentId: nodeId,
                  isExpandable: true,
                  isExpanded: false,
                  isLoading: false,
                  isLoaded: false,
                  children: [],
                  metadata: { connectionId, database, engine },
                };
              }
            } catch (e) {
              console.warn('[Explorer] Failed to get admin adapter:', e);
            }
          }
          break;
        }

        case 'users-folder': {
          const { database, engine } = node.metadata as { database: string; engine: DatabaseEngine };
          const adapter = AdminAdapterFactory.getAdapter(engine);
          const query = adapter.getUsersQuery();
          
          if (query) {
             const result = await queryApi.execute(connectionId, query);
             if (result.rows) {
               const users = result.rows.map(row => {
                 const obj: Record<string, any> = {};
                 result.columns.forEach((col, i) => {
                   obj[col.name] = getCellValue(row[i]);
                 });
                 return obj;
               });

               for (const row of users) {
                 const name = row.name as string;
                 if (!name) continue;

                 const userId = createNodeId('user', connectionId, database, name);
                 childIds.push(userId);
                 newNodes[userId] = {
                   id: userId,
                   type: 'user',
                   name: name,
                   parentId: nodeId,
                   isExpandable: false, // For now
                   isExpanded: false,
                   isLoading: false,
                   isLoaded: true,
                   children: [],
                   metadata: { connectionId, database, user: name, ...row },
                 };
               }
             }
          }
          break;
        }

        case 'roles-folder': {
          const { database, engine } = node.metadata as { database: string; engine: DatabaseEngine };
          const adapter = AdminAdapterFactory.getAdapter(engine);
          const query = adapter.getRolesQuery();
          
          if (query) {
             const result = await queryApi.execute(connectionId, query);
             if (result.rows) {
               const roles = result.rows.map(row => {
                 const obj: Record<string, any> = {};
                 result.columns.forEach((col, i) => {
                   obj[col.name] = getCellValue(row[i]);
                 });
                 return obj;
               });

               for (const row of roles) {
                 const name = row.name as string;
                 if (!name) continue;

                 const roleId = createNodeId('role', connectionId, database, name);
                 childIds.push(roleId);
                 newNodes[roleId] = {
                   id: roleId,
                   type: 'role',
                   name: name,
                   parentId: nodeId,
                   isExpandable: false,
                   isExpanded: false,
                   isLoading: false,
                   isLoaded: true,
                   children: [],
                   metadata: { connectionId, database, role: name, ...row },
                 };
               }
             }
          }
          break;
        }

        case 'schema': {
          const { database, schema } = node.metadata as { database: string; schema: string };
          
          // Crear carpetas para cada tipo de objeto
          const folders = [
            { type: 'tables-folder' as const, name: 'Tables' },
            { type: 'views-folder' as const, name: 'Views' },
            { type: 'functions-folder' as const, name: 'Functions' },
            { type: 'sequences-folder' as const, name: 'Sequences' },
          ];

          for (const folder of folders) {
            const folderId = createNodeId(folder.type, connectionId, database, schema);
            childIds.push(folderId);
            newNodes[folderId] = {
              id: folderId,
              type: folder.type,
              name: folder.name,
              parentId: nodeId,
              isExpandable: true,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
              metadata: { connectionId, database, schema },
            };
          }
          break;
        }

        case 'tables-folder': {
          const { schema } = node.metadata as { schema: string };
          console.log('[Explorer] Loading tables for schema:', { connectionId, schema });
          const tables = await schemaApi.listTables(connectionId, schema);
          console.log('[Explorer] Tables loaded:', tables);
          
          // Actualizar el catálogo de esquema con las tablas cargadas
          tables.forEach(table => {
            // Asegurar que el schema esté establecido (PostgreSQL lo necesita para el nombre completo)
            if (!table.schema && schema) {
              table.schema = schema;
            }
            schemaCatalog.updateTable(table);
          });
          
          for (const table of tables) {
            const tableNodeId = createNodeId('table', connectionId, schema, table.name);
            childIds.push(tableNodeId);
            newNodes[tableNodeId] = {
              id: tableNodeId,
              type: 'table',
              name: table.name,
              parentId: nodeId,
              isExpandable: true,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
              metadata: { connectionId, schema, table: table.name },
            };
          }
          break;
        }

        case 'table': {
          const { schema, table } = node.metadata as { schema: string; table: string };
          
          const subFolders = [
            { type: 'columns-folder' as const, name: 'Columns' },
            { type: 'indexes-folder' as const, name: 'Indexes' },
            { type: 'constraints-folder' as const, name: 'Constraints' },
            { type: 'triggers-folder' as const, name: 'Triggers' },
          ];

          for (const folder of subFolders) {
            const folderId = createNodeId(folder.type, connectionId, schema, table);
            childIds.push(folderId);
            newNodes[folderId] = {
              id: folderId,
              type: folder.type,
              name: folder.name,
              parentId: nodeId,
              isExpandable: true,
              isExpanded: false,
              isLoading: false,
              isLoaded: false,
              children: [],
              metadata: { connectionId, schema, table },
            };
          }
          break;
        }

        case 'columns-folder': {
          const { schema, table } = node.metadata as { schema: string; table: string };
          const columns = await schemaApi.getColumns(connectionId, table, schema);
          
          for (const col of columns) {
            const colNodeId = createNodeId('column', connectionId, schema, table, col.name);
            childIds.push(colNodeId);
            newNodes[colNodeId] = {
              id: colNodeId,
              type: 'column',
              name: col.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...col },
            };
          }
          break;
        }

        case 'indexes-folder': {
          const { schema, table } = node.metadata as { schema: string; table: string };
          const indexes = await schemaApi.listIndexes(connectionId, table, schema);
          
          for (const idx of indexes) {
            const idxNodeId = createNodeId('index', connectionId, schema, table, idx.name);
            childIds.push(idxNodeId);
            newNodes[idxNodeId] = {
              id: idxNodeId,
              type: 'index',
              name: idx.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...idx },
            };
          }
          break;
        }

        case 'constraints-folder': {
          const { schema, table } = node.metadata as { schema: string; table: string };
          const constraints = await schemaApi.listConstraints(connectionId, table, schema);
          
          for (const con of constraints) {
            const conNodeId = createNodeId('constraint', connectionId, schema, table, con.name);
            childIds.push(conNodeId);
            newNodes[conNodeId] = {
              id: conNodeId,
              type: 'constraint',
              name: con.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...con },
            };
          }
          break;
        }

        case 'triggers-folder': {
          const { schema, table } = node.metadata as { schema: string; table: string };
          const triggers = await schemaApi.listTriggers(connectionId, table, schema);
          
          for (const trg of triggers) {
            const trgNodeId = createNodeId('trigger', connectionId, schema, table, trg.name);
            childIds.push(trgNodeId);
            newNodes[trgNodeId] = {
              id: trgNodeId,
              type: 'trigger',
              name: trg.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...trg },
            };
          }
          break;
        }

        case 'views-folder': {
          const { schema } = node.metadata as { schema: string };
          const views = await schemaApi.listViews(connectionId, schema);
          
          for (const view of views) {
            const viewNodeId = createNodeId('view', connectionId, schema, view.name);
            childIds.push(viewNodeId);
            newNodes[viewNodeId] = {
              id: viewNodeId,
              type: 'view',
              name: view.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...view },
            };
          }
          break;
        }

        case 'functions-folder': {
          const { schema } = node.metadata as { schema: string };
          const functions = await schemaApi.listFunctions(connectionId, schema);
          
          for (const fn of functions) {
            const fnNodeId = createNodeId('function', connectionId, schema, fn.name);
            childIds.push(fnNodeId);
            newNodes[fnNodeId] = {
              id: fnNodeId,
              type: 'function',
              name: fn.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...fn },
            };
          }
          break;
        }

        case 'sequences-folder': {
          const { schema } = node.metadata as { schema: string };
          const sequences = await schemaApi.listSequences(connectionId, schema);
          
          for (const seq of sequences) {
            const seqNodeId = createNodeId('sequence', connectionId, schema, seq.name);
            childIds.push(seqNodeId);
            newNodes[seqNodeId] = {
              id: seqNodeId,
              type: 'sequence',
              name: seq.name,
              parentId: nodeId,
              isExpandable: false,
              isExpanded: false,
              isLoading: false,
              isLoaded: true,
              children: [],
              metadata: { ...seq },
            };
          }
          break;
        }
      }

      // Update cache
      const newCache = new Map(cache);
      newCache.set(cacheKey, { data: childIds, timestamp: Date.now() });

      set((state) => {
        const loadingNodes = new Set(state.loadingNodes);
        loadingNodes.delete(nodeId);
        
        return {
          nodes: {
            ...state.nodes,
            ...newNodes,
            [nodeId]: {
              ...state.nodes[nodeId],
              isLoading: false,
              isLoaded: true,
              children: childIds,
            },
          },
          loadingNodes,
          cache: newCache,
        };
      });
    } catch (error) {
      console.error('[Explorer] Error loading children:', error);
      console.error('[Explorer] Error details:', { nodeId, connectionId, nodeType: node.type });
      set((state) => {
        const loadingNodes = new Set(state.loadingNodes);
        loadingNodes.delete(nodeId);
        return {
          nodes: {
            ...state.nodes,
            [nodeId]: { ...state.nodes[nodeId], isLoading: false },
          },
          loadingNodes,
        };
      });
    }
  },

  refreshNode: async (nodeId, connectionId) => {
    const { cache } = get();
    const newCache = new Map(cache);
    
    // Invalidar cache para este nodo y sus hijos
    for (const key of newCache.keys()) {
      if (key.startsWith(nodeId)) {
        newCache.delete(key);
      }
    }

    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], isLoaded: false, children: [] },
      },
      cache: newCache,
    }));

    await get().loadChildren(nodeId, connectionId);
  },

  setShowSystemSchemas: (show) => {
    set({ showSystemSchemas: show });
    // Invalidar cache de schemas
    const { cache } = get();
    const newCache = new Map(cache);
    for (const key of newCache.keys()) {
      if (key.includes('database:')) {
        newCache.delete(key);
      }
    }
    set({ cache: newCache });
  },

  clearCache: () => {
    set({ cache: new Map() });
  },

  removeConnection: (connectionId) => {
    set((state) => {
      const connNodeId = createNodeId('connection', connectionId);
      const newNodes = { ...state.nodes };
      const nodesToRemove: string[] = [];

      // Encontrar todos los nodos relacionados con esta conexión
      for (const [id, node] of Object.entries(newNodes)) {
        if (id.includes(connectionId) || node.metadata?.connectionId === connectionId) {
          nodesToRemove.push(id);
        }
      }

      for (const id of nodesToRemove) {
        delete newNodes[id];
      }

      return {
        nodes: newNodes,
        rootNodes: state.rootNodes.filter((id) => id !== connNodeId),
        selectedNodeId: nodesToRemove.includes(state.selectedNodeId ?? '')
          ? null
          : state.selectedNodeId,
      };
    });
  },

  getNodePath: (nodeId: string): TreeNode[] => {
    const state = get();
    const path: TreeNode[] = [];
    let currentId: string | null = nodeId;

    while (currentId) {
      const currentNode: TreeNode | undefined = state.nodes[currentId];
      if (currentNode) {
        path.unshift(currentNode);
        currentId = currentNode.parentId;
      } else {
        break;
      }
    }

    return path;
  },
}));
