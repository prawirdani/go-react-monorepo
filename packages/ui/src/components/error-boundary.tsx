import { AlertTriangle } from "@repo/ui/icons"
import {
  Component,
  type ComponentType,
  type PropsWithChildren,
  type ReactNode,
  Suspense,
} from "react"

// The props our Fallback component should implement
export interface ErrorFallbackProps {
  error: Error
  reset: () => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ComponentType<ErrorFallbackProps>
  onError?: (e: unknown) => void
}

interface State {
  error: Error | null
}

/**
  * Example fallback comp:
  * const MyFallbackUI = ({ error, reset }: ErrorFallbackProps) => (
    <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive">
      <p>Failed to load data: {error.message}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="underline font-bold"
      >
        Try again
      </button>
    </div>
  )
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  reset = () => {
    this.setState({ error: null })
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error)
  }

  render() {
    const { error } = this.state

    if (error) {
      const { fallback: Fallback } = this.props

      if (Fallback) {
        return <Fallback error={error} reset={this.reset} />
      }

      return (
        <div className="flex-1 flex flex-col gap-2 w-full items-center justify-center min-h-[300px]">
          <AlertTriangle className="size-12 text-destructive" />
          <p className="text-base md:text-lg text-center">
            Terjadi kesalahan coba lagi beberapa saat.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}

type SuspenderProps = PropsWithChildren<{
  fallback?: ReactNode
  errorFallback?: ComponentType<ErrorFallbackProps>
  onError?: (error: unknown) => void
}>

// React Suspense + ErrorBoundary
export function Suspender({
  children,
  fallback,
  ...errorProps
}: SuspenderProps) {
  return (
    <ErrorBoundary {...errorProps}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
