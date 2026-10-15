import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page">
        <section className="message-card message-card--error">
          <h2 className="card-title">Something went wrong</h2>
          <p className="message-body">
            The app ran into an unexpected problem. Reload the page to try again.
          </p>
          <button className="reroll-button" type="button" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </section>
      </main>
    );
  }
}
