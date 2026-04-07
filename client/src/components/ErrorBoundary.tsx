import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <h2>Noe gikk galt</h2>
          <p>En uventet feil oppsto. Prøv å laste siden på nytt.</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Prøv igjen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
