import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { withTranslation, WithTranslation } from 'react-i18next';

interface TemplateErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface TemplateErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

type Props = TemplateErrorBoundaryProps & WithTranslation<'pages'>;

class TemplateErrorBoundaryComponent extends React.Component<
  Props,
  TemplateErrorBoundaryState
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<TemplateErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Template Error Boundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback: CustomFallback, t } = this.props;

    if (hasError && error) {
      if (CustomFallback) {
        return <CustomFallback error={error} reset={this.handleReset} />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-lg">{t('templates.errorBoundary.title')}</CardTitle>
              <CardDescription>
                {t('templates.errorBoundary.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <div className="font-semibold mb-1">{t('templates.errorBoundary.errorDetails')}</div>
                <div className="font-mono text-xs break-all">
                  {error.message}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReset} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('buttons.tryAgain')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/templates'}
                  className="w-full"
                >
                  {t('templates.errorBoundary.returnToTemplates')}
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {t('templates.errorBoundary.showStackTrace')}
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

const TemplateErrorBoundary = withTranslation<'pages'>('pages')(TemplateErrorBoundaryComponent);

export { TemplateErrorBoundary };
