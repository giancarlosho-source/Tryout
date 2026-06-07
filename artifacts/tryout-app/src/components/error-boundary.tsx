import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; label?: string; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-black text-red-700 mb-2">
            {this.props.label ?? "App"} crashed
          </h1>
          <pre className="text-xs text-red-600 bg-red-100 rounded-xl p-4 max-w-lg overflow-auto text-left whitespace-pre-wrap">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
