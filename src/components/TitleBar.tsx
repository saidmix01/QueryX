import { useState, useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { os } from '@tauri-apps/api';
import { Minus, Square, X, Maximize2, Info } from 'lucide-react';
import { useUIStore } from '../store/ui-store';
import { useConnectionStore } from '../store/connection-store';
import { isLinux } from '../utils/platform-fixes';

export function TitleBar() {
  const ua = navigator.userAgent.toLowerCase();
  const root = document.documentElement;
  const uaMac = ua.includes('mac os') || ua.includes('macintosh') || root.classList.contains('is-mac');
  const uaWin = ua.includes('windows');
  const uaLin = ua.includes('linux') || root.classList.contains('is-linux');
  const initialPlatform = uaMac ? 'darwin' : uaWin ? 'win32' : uaLin ? 'linux' : '';
  const [isMaximized, setIsMaximized] = useState(true);
  const [platform, setPlatform] = useState<string>(initialPlatform);
  const [isLinuxPlatform, setIsLinuxPlatform] = useState(uaLin);
  const setAboutModalOpen = useUIStore((s) => s.setAboutModalOpen);
  const { activeConnectionId, connections } = useConnectionStore();
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const isTauri = typeof (window as any).__TAURI_IPC__ === 'function';

  useEffect(() => {
    // Detectar plataforma
    if (isTauri) {
      os.platform().then(setPlatform).catch(() => setPlatform('unknown'));
    } else {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('mac os') || ua.includes('macintosh')) setPlatform('darwin');
      else if (ua.includes('windows')) setPlatform('win32');
      else if (ua.includes('linux')) setPlatform('linux');
      else setPlatform('unknown');
    }
    
    // Detectar si es Linux (para ocultar TitleBar personalizado)
    isLinux().then(setIsLinuxPlatform).catch(() => setIsLinuxPlatform(false));

    // Escuchar cambios en el estado de maximizado
    let unlistenPromise: Promise<() => void> | null = null;
    if (isTauri) {
      unlistenPromise = appWindow.onResized(async () => {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      });
      // Verificar estado inicial
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    }

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then((fn) => fn()).catch(() => {});
      }
    };
  }, [isTauri]);

  const handleMinimize = () => {
    if (isTauri) appWindow.minimize();
  };
  
  const handleMaximize = async () => {
    if (isMaximized) {
      if (isTauri) await appWindow.unmaximize();
    } else {
      if (isTauri) await appWindow.maximize();
    }
  };

  const handleClose = () => {
    if (isTauri) appWindow.close();
  };

  const isMacOS = platform === 'darwin';

  // En Linux, no mostrar TitleBar personalizado (usar barra del sistema)
  if (isLinuxPlatform) {
    return null;
  }
  // En macOS, usar la barra nativa (no mostrar personalizada)
  if (isMacOS) {
    return null;
  }

  // Componente de botones de ventana
  const WindowControls = () => (
    <div className="flex items-center h-full">
      {/* Minimizar */}
      <button
        data-tauri-drag-region="false"
        onClick={handleMinimize}
        className="h-full w-11 flex items-center justify-center hover:bg-dark-hover transition-colors group"
        title="Minimizar"
      >
        <Minus className="w-4 h-4 text-dark-muted group-hover:text-dark-text" />
      </button>

      {/* Maximizar/Restaurar */}
      <button
        data-tauri-drag-region="false"
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
        data-tauri-drag-region="false"
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
      {/* Espaciador izquierdo (sin controles en macOS) */}

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
        data-tauri-drag-region="false"
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
