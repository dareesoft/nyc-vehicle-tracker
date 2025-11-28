/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  componentName?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          componentName={this.props.componentName}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

// Default error fallback UI
interface ErrorFallbackProps {
  error: Error | null
  componentName?: string
  onRetry?: () => void
}

function ErrorFallback({ error, componentName, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center h-full w-full bg-cyber-dark/50 p-6">
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="w-16 h-16 mx-auto mb-4 border-2 border-cyber-magenta/50 rounded-lg flex items-center justify-center">
          <svg
            className="w-8 h-8 text-cyber-magenta"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error title */}
        <h3 className="text-cyber-magenta font-mono text-lg mb-2 tracking-wider">
          SYSTEM ERROR
        </h3>

        {/* Component name */}
        {componentName && (
          <p className="text-cyber-magenta/50 text-xs font-mono mb-3">
            Component: {componentName}
          </p>
        )}

        {/* Error message */}
        <p className="text-cyber-cyan/70 text-sm mb-4">
          {error?.message || 'An unexpected error occurred'}
        </p>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="cyber-button cyber-button-magenta px-6 py-2"
          >
            RETRY
          </button>
        )}

        {/* Error details (collapsed) */}
        {error && (
          <details className="mt-4 text-left">
            <summary className="text-cyber-cyan/30 text-xs cursor-pointer hover:text-cyber-cyan/50">
              Show technical details
            </summary>
            <pre className="mt-2 p-3 bg-cyber-black/50 rounded text-[10px] text-cyber-cyan/50 overflow-auto max-h-32 font-mono">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// Specialized error boundaries for specific components

/**
 * Map Error Boundary - for Map2D/Map3D components
 */
export function MapErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      componentName="Map"
      fallback={
        <div className="flex items-center justify-center h-full w-full bg-cyber-dark">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 border border-cyber-magenta/30 rounded-lg flex items-center justify-center">
              <svg
                className="w-10 h-10 text-cyber-magenta/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <p className="text-cyber-magenta font-mono text-sm">MAP ERROR</p>
            <p className="text-cyber-magenta/50 text-xs mt-1">Failed to load map component</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 border border-cyber-magenta/30 rounded text-cyber-magenta/70 text-xs hover:bg-cyber-magenta/10"
            >
              RELOAD PAGE
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Image Error Boundary - for CameraViewer
 */
export function ImageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      componentName="ImageViewer"
      fallback={
        <div className="flex items-center justify-center h-full w-full bg-cyber-black">
          <div className="text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-cyber-cyan/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-cyber-cyan/50 text-xs font-mono">IMAGE LOAD ERROR</p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Panel Error Boundary - for side panels
 */
export function PanelErrorBoundary({ 
  children, 
  panelName 
}: { 
  children: ReactNode
  panelName: string 
}) {
  return (
    <ErrorBoundary
      componentName={panelName}
      fallback={
        <div className="p-4 text-center">
          <p className="text-cyber-magenta/70 text-sm font-mono">Error loading {panelName}</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

export default ErrorBoundary

