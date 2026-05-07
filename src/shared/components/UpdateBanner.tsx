import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Revisar si el server tiene una versión nueva cada 30 minutos.
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => undefined);
      }, 30 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm bg-white border-2 border-primary-500 rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
        <RefreshCw size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-gray-900">Nueva versión disponible</div>
        <div className="text-xs text-gray-600 mt-0.5">
          Hay cambios nuevos publicados. Actualizá para usarlos.
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Actualizar ahora
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-semibold transition-colors"
          >
            Después
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
    </div>
  );
}
