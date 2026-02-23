import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-gray-100 font-sans">
          <h1 className="text-xl font-semibold text-error mb-2">Algo deu errado</h1>
          <pre className="bg-gray-800 p-4 rounded text-sm overflow-auto max-w-2xl mb-4">
            {this.state.error.message}
          </pre>
          <p className="text-gray-400 text-sm mb-4">
            Abra o Console (F12 → Console) para mais detalhes. Corrija o erro e recarregue.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700"
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
