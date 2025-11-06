import '@testing-library/jest-dom';

// Mock Supabase client
type SupabaseQueryResult = { data: unknown; error: unknown };

const createQueryResult = (overrides?: Partial<SupabaseQueryResult>): SupabaseQueryResult => ({
  data: null,
  error: null,
  ...overrides,
});

const createQueryBuilder = (initialResult?: Partial<SupabaseQueryResult>) => {
  let resolved = createQueryResult(initialResult);

  const resolveWith = (result: Partial<SupabaseQueryResult>) => {
    resolved = createQueryResult(result);
    return builder;
  };

  const asPromise = () => Promise.resolve(resolved);

  const builder: any = {
    __setResponse: resolveWith,
    then: (onFulfilled: (value: SupabaseQueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      asPromise().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => asPromise().catch(onRejected),
    finally: (onFinally: () => void) => asPromise().finally(onFinally),
  };

  const chainableMethods = [
    'select',
    'insert',
    'upsert',
    'update',
    'delete',
    'eq',
    'neq',
    'gte',
    'lte',
    'gt',
    'lt',
    'ilike',
    'like',
    'in',
    'not',
    'or',
    'contains',
    'filter',
    'match',
    'order',
    'limit',
    'range',
    'overlaps',
    'textSearch',
    'throwOnError',
  ] as const;

  chainableMethods.forEach((method) => {
    builder[method] = jest.fn().mockImplementation(() => builder);
  });

  builder.single = jest.fn().mockImplementation(() => asPromise());
  builder.maybeSingle = jest.fn().mockImplementation(() => asPromise());
  builder.returns = jest.fn().mockImplementation((result: Partial<SupabaseQueryResult>) => resolveWith(result));
  builder.clone = jest.fn().mockImplementation(() => createQueryBuilder(resolved));
  builder.execute = jest.fn().mockImplementation(() => asPromise());

  return builder;
};

const createStorageBucket = () => ({
  upload: jest.fn().mockResolvedValue(createQueryResult()),
  remove: jest.fn().mockResolvedValue(createQueryResult()),
  list: jest.fn().mockResolvedValue(createQueryResult({ data: [] })),
  download: jest.fn().mockResolvedValue(createQueryResult()),
});

const createSupabaseMock = () => {
  const mock: any = {
    from: jest.fn(() => createQueryBuilder()),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signIn: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    rpc: jest.fn().mockResolvedValue(createQueryResult()),
    storage: {
      from: jest.fn(() => createStorageBucket()),
    },
    functions: {
      invoke: jest.fn().mockResolvedValue(createQueryResult()),
    },
    __createQueryBuilder: createQueryBuilder,
  };

  return mock;
};

jest.mock('@/integrations/supabase/client', () => ({
  supabase: createSupabaseMock(),
}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    }
  }
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  disconnect: jest.fn(),
  observe: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock matchMedia for components relying on it (e.g., ThemeProvider)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

if (!window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}

if (!window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}

if (!window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}