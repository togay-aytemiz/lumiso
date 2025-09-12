import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface InvitationErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface InvitationErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class InvitationErrorBoundary extends React.Component<
  InvitationErrorBoundaryProps,
  InvitationErrorBoundaryState
> {
  constructor(props: InvitationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): InvitationErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Invitation error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Something went wrong with team invitations. Please try again.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="ml-4"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}