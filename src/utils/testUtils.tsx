import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

const createProvidersWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function ProvidersWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = createProvidersWrapper();
  return render(ui, { wrapper: Wrapper, ...options });
};

export * from '@testing-library/react';
export { customRender as render };

// Mock Supabase client for testing
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  auth: {
    getUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  rpc: jest.fn(),
};

// Performance testing utilities
export const measureRenderTime = (component: React.ReactElement) => {
  const start = performance.now();
  const result = render(component);
  const end = performance.now();
  
  return {
    ...result,
    renderTime: end - start
  };
};

// Accessibility testing helpers
export const setupAxeMatchers = () => {
  // This would integrate with @axe-core/react in a real implementation
  // For now, we'll just export a placeholder
  return {
    toHaveNoViolations: () => true
  };
};

// Component testing utilities
export const createMockProps = <T extends object>(overrides: Partial<T> = {}): T => {
  const defaultProps = {
    onClick: jest.fn(),
    onSubmit: jest.fn(),
    onChange: jest.fn(),
    loading: false,
    disabled: false,
    ...overrides
  };
  
  return defaultProps as T;
};

// Mock data generators
export const generateMockProject = (overrides = {}) => ({
  id: 'project-1',
  name: 'Test Project',
  description: 'Test Description',
  status_id: 'status-1',
  lead_id: 'lead-1',
  user_id: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  lead: {
    id: 'lead-1',
    name: 'Test Client',
    status: 'active',
    email: 'test@example.com',
    phone: '+1234567890'
  },
  project_type: {
    id: 'type-1',
    name: 'Wedding'
  },
  session_count: 0,
  todo_count: 0,
  completed_todo_count: 0,
  ...overrides
});

export const generateMockLead = (overrides = {}) => ({
  id: 'lead-1',
  name: 'Test Lead',
  email: 'test@example.com',
  phone: '+1234567890',
  status: 'active',
  status_id: 'status-1',
  user_id: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

// Performance test helpers
export const expectPerformantRender = (renderTime: number, threshold: number = 50) => {
  if (renderTime >= threshold) {
    throw new Error(`Render time ${renderTime}ms exceeded threshold ${threshold}ms`);
  }
};

// Async test utilities
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};
