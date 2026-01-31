import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import clsx from 'clsx';
import { useQueryStore } from '../store/query-store';
import { useConnectionStore } from '../store/connection-store';

export function QueryTabs() {
  const { tabs, activeTabId, createTab, closeTab, setActiveTab } = useQueryStore();
  const { activeConnectionId } = useConnectionStore();

  return (
    <div className="flex items-center bg-dark-surface/50 backdrop-blur-sm border-b border-dark-border/30">
      <div className="flex-1 flex overflow-x-auto scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {tabs.map((tab, index) => {
            const isActive = activeTabId === tab.id;
            return (
              <motion.div
                key={tab.id}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.12 }}
                className={clsx(
                  'group relative flex items-center gap-1.5 px-3 py-2 border-r border-dark-border/30 cursor-pointer transition-all',
                  isActive
                    ? 'bg-dark-bg text-matrix-400'
                    : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover/30'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-matrix-500 shadow-glow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                <span className="text-xs font-medium whitespace-nowrap">
                  Query {index + 1}
                </span>

                {/* Executing indicator */}
                {tab.isExecuting && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-matrix-500 animate-pulse-glow"
                  />
                )}

                {/* Close button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={clsx(
                    'p-0.5 rounded transition-all',
                    isActive
                      ? 'opacity-100 hover:bg-dark-hover/50'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-dark-border/50'
                  )}
                >
                  <X className="w-3 h-3" />
                </motion.button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* New Tab Button */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => activeConnectionId && createTab(activeConnectionId)}
        disabled={!activeConnectionId}
        className="p-2 hover:bg-dark-hover/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="New Query Tab"
      >
        <Plus className="w-3.5 h-3.5 text-matrix-400" />
      </motion.button>
    </div>
  );
}
