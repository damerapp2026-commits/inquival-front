import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl shadow-card p-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <RefreshCw size={20} />
            </div>
            <h1 className="text-base font-bold text-gray-900">Ocurrió un error inesperado</h1>
            <p className="text-sm text-gray-600 mt-1">
              Recargá la página para continuar. Si el problema persiste, contactá a soporte.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
