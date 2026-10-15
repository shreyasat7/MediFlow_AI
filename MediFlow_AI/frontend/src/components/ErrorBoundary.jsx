import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('MediFlow UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui', color: '#b91c1c' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong.</h1>
          <p style={{ marginTop: '0.5rem', color: '#374151' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', borderRadius: 8 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
