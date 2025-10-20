import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { withTranslation, WithTranslation, useTranslation } from 'react-i18next';

interface CommonErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

type Props = CommonErrorBoundaryProps & WithTranslation<'common'>;

interface State {
  hasError: boolean;
  error?: Error;
}

class CommonErrorBoundaryComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 text-destructive">
              <AlertTriangle className="w-full h-full" />
            </div>
            <CardTitle>{this.props.t('errorBoundary.title')}</CardTitle>
            <CardDescription>
              {this.props.t('errorBoundary.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left">
                <details className="text-xs bg-muted p-2 rounded">
                  <summary className="cursor-pointer font-medium">{this.props.t('errorBoundary.errorDetails')}</summary>
                  <pre className="mt-2 whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                </details>
              </div>
            )}
            <Button onClick={this.handleReset} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              {this.props.t('buttons.tryAgain')}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function EntityErrorState({
  error,
  onRetry,
  title
}: {
  error?: string;
  onRetry?: () => void;
  title?: string;
}) {
  const { t } = useTranslation('common');
  const resolvedTitle = title ?? t('errorBoundary.entityDefaultTitle');

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 text-destructive">
          <AlertTriangle className="w-full h-full" />
        </div>
        <CardTitle>{resolvedTitle}</CardTitle>
        {error && (
          <CardDescription className="text-left">
            <details>
              <summary className="cursor-pointer">{t('errorBoundary.errorDetails')}</summary>
              <p className="mt-2 text-sm font-mono bg-muted p-2 rounded">
                {error}
              </p>
            </details>
          </CardDescription>
        )}
      </CardHeader>
      {onRetry && (
        <CardContent className="text-center">
          <Button onClick={onRetry} className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('buttons.tryAgain')}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

const ErrorBoundary = withTranslation<'common'>('common')(CommonErrorBoundaryComponent);

export { ErrorBoundary };
