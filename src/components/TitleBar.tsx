import { useState, useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { os } from '@tauri-apps/api';
import { Minus, Square, X, Maximize2, Info } from 'lucide-react';
import { useUIStore } from '../store/ui-store';
import { useConnectionStore } from '../store/connection-store';
import { isLinux } from '../utils/platform-fixes';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(true);
  const [platform, setPlatform] = useState<string>('');
  const [isLinuxPlatform, setIsLinuxPlatform] = useState(false);
  const setAboutModalOpen = useUIStore((s) => s.setAboutModalOpen);
  const { activeConnectionId, connections } = useConnectionStore();
  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  useEffect(() => {
    // Detectar plataforma
    os.platform().then(setPlatform).catch(() => setPlatform('unknown'));
    
    // Detectar si es Linux (para ocultar TitleBar personalizado)
    isLinux().then(setIsLinuxPlatform).catch(() => setIsLinuxPlatform(false));

    // Escuchar cambios en el estado de maximizado
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    // Verificar estado inicial
    appWindow.isMaximized().then(setIsMaximized);

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => appWindow.minimize();
  
  const handleMaximize = async () => {
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleClose = () => appWindow.close();

  const isMacOS = platform === 'darwin';

  // En Linux, no mostrar TitleBar personalizado (usar barra del sistema)
  if (isLinuxPlatform) {
    return null;
  }

  // Componente de botones de ventana
  const WindowControls = () => (
    <div className="flex items-center h-full">
      {/* Minimizar */}
      <button
        onClick={handleMinimize}
        className="h-full w-11 flex items-center justify-center hover:bg-dark-hover transition-colors group"
        title="Minimizar"
      >
        <Minus className="w-4 h-4 text-dark-muted group-hover:text-dark-text" />
      </button>

      {/* Maximizar/Restaurar */}
      <button
        onClick={handleMaximize}
        className="h-full w-11 flex items-center justify-center hover:bg-dark-hover transition-colors group"
        title={isMaximized ? 'Restaurar' : 'Maximizar'}
      >
        {isMaximized ? (
          <Square className="w-3.5 h-3.5 text-dark-muted group-hover:text-dark-text" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5 text-dark-muted group-hover:text-dark-text" />
        )}
      </button>

      {/* Cerrar */}
      <button
        onClick={handleClose}
        className="h-full w-11 flex items-center justify-center hover:bg-red-600 transition-colors group"
        title="Cerrar"
      >
        <X className="w-4 h-4 text-dark-muted group-hover:text-white" />
      </button>
    </div>
  );

  return (
    <div 
      data-tauri-drag-region
      className="h-9 bg-dark-surface/95 backdrop-blur-sm border-b border-dark-border/50 flex items-center select-none"
    >
      {/* En macOS, los controles van a la izquierda (aunque usamos custom, mantenemos espacio) */}
      {isMacOS && (
        <>
          <WindowControls />
          <div className="h-4 w-px bg-dark-border/30" />
        </>
      )}

      {/* Logo y nombre - área arrastrable */}
      <div data-tauri-drag-region className="flex items-center gap-2 px-3 h-full">
        <img 
          src="/icon.png" 
          alt="QueryX" 
          className="w-4 h-4 object-contain pointer-events-none"
          draggable={false}
        />
        <span className="text-xs font-bold text-matrix-400 tracking-wide pointer-events-none">QueryX</span>
      </div>

      {/* Conexión activa */}
      {activeConnection && (
        <div data-tauri-drag-region className="flex items-center gap-2 px-2 h-full">
          <div className="h-3 w-px bg-dark-border/50" />
          <div className="flex items-center gap-1.5 text-xs pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-matrix-500 animate-pulse" />
            <span className="text-dark-muted">Connected:</span>
            <span className="text-matrix-400 font-medium">{activeConnection.name}</span>
            <span className="text-dark-muted/50">•</span>
            <span className="text-dark-text/80">{activeConnection.database}</span>
          </div>
        </div>
      )}

      {/* Espacio flexible arrastrable */}
      <div data-tauri-drag-region className="flex-1 h-full" />

      {/* Botón Acerca de */}
      <button
        onClick={() => setAboutModalOpen(true)}
        className="h-full px-3 flex items-center justify-center hover:bg-dark-hover/50 transition-colors group"
        title="Acerca de QueryX (F1)"
      >
        <Info className="w-3.5 h-3.5 text-dark-muted group-hover:text-matrix-400" />
      </button>

      {/* En Windows/Linux, los controles van a la derecha */}
      {!isMacOS && (
        <>
          <div className="h-4 w-px bg-dark-border/30" />
          <WindowControls />
        </>
      )}
    </div>
  );
}
