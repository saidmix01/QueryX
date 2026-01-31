import { useWorkspaceStore } from '../store/workspace-store';

export function WorkspaceRestoreIndicator() {
  const { isRestoring } = useWorkspaceStore();

  if (!isRestoring) return null;

  return (
    <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
      <span>Restaurando sesión...</span>
    </div>
  );
}
