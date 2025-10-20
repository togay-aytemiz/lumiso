import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { withTranslation, WithTranslation } from 'react-i18next';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

type Props = ErrorBoundaryProps & WithTranslation<'common'>;

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundaryComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const payload = [
      `${error.name || 'Error'}: ${error.message}`,
      errorInfo?.componentStack ?? '',
      error.stack ?? '',
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(payload);
    } catch (copyError) {
      console.warn('Unable to copy error details', copyError);
    }
  };

  getErrorSummary() {
    const { error } = this.state;
    const { t } = this.props;
    if (!error) return t('errorBoundary.unexpected');

    const isReferenceError =
      error.name === 'ReferenceError' ||
      /^ReferenceError/i.test(error.message);

    if (isReferenceError) {
      const match = error.message.match(/([^ ]+) is not defined/);
      if (match) {
        return t('errorBoundary.missingReference', { reference: match[1] });
      }
      return t('errorBoundary.missingReferenceGeneric');
    }

    return error.message || t('errorBoundary.unexpected');
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorSummary = this.getErrorSummary();
      const { t } = this.props;
      const errorLabel =
        this.state.error?.name && this.state.error?.message
          ? `${this.state.error.name}: ${this.state.error.message}`
          : this.state.error?.message ?? t('errorBoundary.unexpected');

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>{t('errorBoundary.title')}</CardTitle>
              <CardDescription>
                {errorSummary}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={this.handleReset}
                className="w-full"
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('buttons.tryAgain')}
              </Button>
              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                {t('buttons.reload')}
              </Button>

              {this.state.error && (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-left">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("font-medium text-foreground", "break-words")}>
                      {errorLabel}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      onClick={this.handleCopy}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" />
                      {t('buttons.copy')}
                    </Button>
                  </div>
                  {process.env.NODE_ENV === 'development' && (
                    <details className="mt-2 text-muted-foreground/80">
                      <summary className="cursor-pointer font-medium">{t('errorBoundary.stackTrace')}</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed">
                        {this.state.error.stack}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

const ErrorBoundary = withTranslation<'common'>("common")(ErrorBoundaryComponent);

export { ErrorBoundary };
export default ErrorBoundary;
