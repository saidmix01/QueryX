import { motion } from 'framer-motion';
import { Database, History, Layers, Plus, BookMarked } from 'lucide-react';
import { useUIStore } from '../store/ui-store';
import { ConnectionList } from './ConnectionList';
import { DatabaseTree } from './DatabaseTree';
import { QueryHistory } from './QueryHistory';
import { SavedQueriesPanel } from './SavedQueriesPanel';
import clsx from 'clsx';

type SidebarView = 'connections' | 'explorer' | 'history' | 'saved-queries';

const navItems: { id: SidebarView; icon: typeof Database; label: string }[] = [
  { id: 'explorer', icon: Layers, label: 'Explorer' },
  { id: 'saved-queries', icon: BookMarked, label: 'Queries' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'connections', icon: Database, label: 'Connections' },
];

export function Sidebar() {
  const { sidebarView, setSidebarView, openConnectionModal } = useUIStore();

  return (
    <div className="h-full flex bg-dark-surface/50 backdrop-blur-sm border-r border-dark-border/50">
      {/* Icon Navigation - Barra lateral de íconos ultra minimalista */}
      <div className="w-10 bg-dark-bg/50 border-r border-dark-border/30 flex flex-col items-center py-2 gap-0.5">
        {navItems.map(({ id, icon: Icon, label }) => (
          <motion.button
            key={id}
            onClick={() => setSidebarView(id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={clsx(
              'w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 relative group',
              sidebarView === id
                ? 'bg-matrix-900/50 text-matrix-400 shadow-glow-sm'
                : 'text-dark-muted hover:text-matrix-400 hover:bg-dark-hover/50'
            )}
            title={label}
          >
            <Icon className="w-4 h-4" />
            {/* Indicador activo */}
            {sidebarView === id && (
              <motion.div
                layoutId="activeTab"
                className="absolute -right-px top-1.5 bottom-1.5 w-0.5 bg-matrix-500 rounded-l"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-dark-elevated/95 backdrop-blur-sm border border-dark-border/50 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {label}
            </span>
          </motion.button>
        ))}

        <div className="flex-1" />

        {/* New Connection Button */}
        <motion.button
          onClick={() => openConnectionModal()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-8 h-8 rounded-md flex items-center justify-center text-matrix-500 hover:bg-matrix-900/50 hover:text-matrix-400 transition-all duration-150 group relative"
          title="New Connection"
        >
          <Plus className="w-4 h-4" />
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-elevated/95 backdrop-blur-sm border border-dark-border/50 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
            New Connection
          </span>
        </motion.button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Más compacto */}
        <div className="px-3 py-2 border-b border-dark-border/50 bg-dark-elevated/30">
          <h2 className="text-xs font-semibold text-matrix-400/90 uppercase tracking-wider">
            {navItems.find((item) => item.id === sidebarView)?.label}
          </h2>
        </div>

        {/* Content con animación */}
        <div className="flex-1 overflow-auto">
          <motion.div
            key={sidebarView}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12 }}
            className="h-full"
          >
            {sidebarView === 'connections' && <ConnectionList />}
            {sidebarView === 'explorer' && <DatabaseTree />}
            {sidebarView === 'saved-queries' && <SavedQueriesPanel />}
            {sidebarView === 'history' && <QueryHistory />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
