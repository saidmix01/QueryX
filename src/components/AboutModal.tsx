import { motion, AnimatePresence } from 'framer-motion';
import { X, Database, Code, Globe, Github } from 'lucide-react';
import { useUIStore } from '../store/ui-store';

export function AboutModal() {
  const { isAboutModalOpen, setAboutModalOpen } = useUIStore();

  if (!isAboutModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setAboutModalOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-dark-surface border border-dark-border rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header con gradiente */}
          <div className="relative bg-gradient-to-br from-matrix-900/50 via-dark-surface to-dark-surface border-b border-dark-border/50 p-6">
            <button
              onClick={() => setAboutModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-dark-hover/50 transition-colors group"
            >
              <X className="w-4 h-4 text-dark-muted group-hover:text-dark-text" />
            </button>

            {/* Logo y nombre */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-matrix-500/20 blur-xl rounded-full" />
                <div className="relative w-16 h-16 bg-gradient-to-br from-matrix-500 to-matrix-700 rounded-xl flex items-center justify-center shadow-lg">
                  <img 
                    src="/icon.png" 
                    alt="QueryX Logo" 
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      // Fallback si la imagen no carga
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = '<svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>';
                    }}
                  />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-dark-text">QueryX</h2>
                <p className="text-sm text-matrix-400 font-medium">Professional SQL Database Manager</p>
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-6 space-y-6">
            {/* Versión */}
            <div className="flex items-center justify-between p-3 bg-dark-bg/50 rounded-lg border border-dark-border/30">
              <span className="text-sm text-dark-muted">Versión</span>
              <span className="text-sm font-mono text-matrix-400 font-semibold">1.0.0</span>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <p className="text-sm text-dark-text leading-relaxed">
                QueryX es un gestor de bases de datos SQL profesional con soporte para múltiples motores de bases de datos.
              </p>
              <p className="text-xs text-dark-muted leading-relaxed">
                Diseñado para desarrolladores que necesitan una herramienta potente, rápida y elegante para trabajar con PostgreSQL, MySQL y SQLite.
              </p>
            </div>

            {/* Características */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Características</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Database, text: 'Multi-motor' },
                  { icon: Code, text: 'Editor SQL' },
                  { icon: Globe, text: 'Query Builder' },
                  { icon: Database, text: 'Workspaces' }
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-dark-bg/30 rounded border border-dark-border/20">
                    <feature.icon className="w-3.5 h-3.5 text-matrix-500" />
                    <span className="text-xs text-dark-text">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tecnologías */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Tecnologías</h3>
              <div className="flex flex-wrap gap-2">
                {['React', 'TypeScript', 'Tauri', 'Rust', 'Monaco Editor'].map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-1 text-xs bg-matrix-900/30 text-matrix-400 rounded border border-matrix-700/30 font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-dark-border/30">
              <div className="flex justify-center mb-3">
                <a
                  href="https://github.com/saidmix01/QueryX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg hover:bg-dark-hover border border-dark-border rounded-full transition-colors text-xs text-dark-text hover:text-matrix-400 group"
                >
                  <Github className="w-3.5 h-3.5 text-dark-muted group-hover:text-matrix-400 transition-colors" />
                  <span>Ver en GitHub</span>
                </a>
              </div>
              <p className="text-xs text-center text-dark-muted">
                © 2024-2026 QueryX. Todos los derechos reservados.
              </p>
              <p className="text-xs text-center text-dark-muted/70 mt-1">
                Hecho con ❤️ para desarrolladores
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
