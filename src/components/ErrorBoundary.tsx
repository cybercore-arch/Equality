import { Component, type ReactNode } from 'react';

/** Если интерфейс упал, показываем причину вместо чёрного экрана, чтобы её можно было сфотографировать. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ padding: 24, color: '#fafafa', background: '#09090b', minHeight: '100dvh', font: '14px system-ui' }}>
        <h2 style={{ margin: 0 }}>Что-то пошло не так</h2>
        <p style={{ color: '#a1a1aa' }}>Пришли скриншот этого экрана разработчику.</p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{error.message}{'\n'}{error.stack?.split('\n').slice(0, 6).join('\n')}</pre>
        <button onClick={() => location.reload()} style={{ padding: '10px 16px', borderRadius: 12, border: 0 }}>
          Перезапустить
        </button>
      </div>
    );
  }
}
