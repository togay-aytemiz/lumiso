import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CalendarErrorBoundaryProps {
  children: React.ReactNode;
  error?: Error | null;
  retry?: () => void;
}

interface CalendarErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically designed for calendar-related failures
 * Provides graceful degradation and retry functionality
 */
export class CalendarErrorBoundary extends React.Component<CalendarErrorBoundaryProps, CalendarErrorBoundaryState> {
  constructor(props: CalendarErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CalendarErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Calendar Error Boundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.retry?.();
  };

  render() {
    // Handle prop-based errors (from hooks)
    const error = this.state.error || this.props.error;
    const hasError = this.state.hasError || !!this.props.error;

    if (hasError && error) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Calendar Load Failed</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p className="text-sm text-muted-foreground">
                Unable to load calendar data. This might be due to a network issue or server problem.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">Error Details</summary>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-red-600">
                    {error.message}
                  </pre>
                </details>
              )}
              <div className="flex gap-2">
                <Button 
                  onClick={this.handleRetry}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

/**
 * Hook-friendly wrapper for the error boundary
 */
export function CalendarErrorWrapper({ 
  children, 
  error, 
  retry 
}: { 
  children: React.ReactNode; 
  error?: Error | null; 
  retry?: () => void;
}) {
  return (
    <CalendarErrorBoundary error={error} retry={retry}>
      {children}
    </CalendarErrorBoundary>
  );
}