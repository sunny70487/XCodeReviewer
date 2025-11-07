/**
 * React錯誤邊界元件
 * 捕獲元件樹中的JavaScript錯誤並記錄
 */

import React, { Component, ReactNode } from 'react';
import { logger, LogCategory } from '@/shared/utils/logger';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 記錄錯誤到日誌系統
    logger.error(
      LogCategory.CONSOLE_ERROR,
      `React元件錯誤: ${error.message}`,
      {
        error: error.toString(),
        componentStack: errorInfo.componentStack,
      },
      error.stack
    );

    this.setState({
      errorInfo,
    });

    // 呼叫自定義錯誤處理
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定義fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 預設錯誤UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-6 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">出錯了</h2>
                <p className="text-sm text-muted-foreground">應用遇到了一個錯誤</p>
              </div>
            </div>

            {this.state.error && (
              <div className="space-y-2">
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">
                    {this.state.error.message}
                  </p>
                </div>

                {import.meta.env.DEV && this.state.error.stack && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium text-muted-foreground">
                      檢視錯誤堆疊
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}

                {import.meta.env.DEV && this.state.errorInfo?.componentStack && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium text-muted-foreground">
                      檢視元件堆疊
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={this.handleReset} variant="outline" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                重試
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                返回首頁
              </Button>
              <Button onClick={this.handleReload} className="flex-1">
                重新整理頁面
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              錯誤已被記錄，我們會盡快修復
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 高階元件：為元件新增錯誤邊界
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
