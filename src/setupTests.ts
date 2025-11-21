import '@testing-library/jest-dom';
import './i18n';

// Mock Supabase client
type SupabaseQueryResult = { data: unknown; error: unknown };

const SUPABASE_CHAINABLE_METHODS = [
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

type ChainableMethod = typeof SUPABASE_CHAINABLE_METHODS[number];

type MockQueryBuilder = {
  __setResponse: (result: Partial<SupabaseQueryResult>) => MockQueryBuilder;
  then: (onFulfilled: (value: SupabaseQueryResult) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  catch: (onRejected: (reason: unknown) => unknown) => Promise<unknown>;
  finally: (onFinally: () => void) => Promise<unknown>;
  single: jest.Mock<Promise<SupabaseQueryResult>, []>;
  maybeSingle: jest.Mock<Promise<SupabaseQueryResult>, []>;
  returns: jest.Mock<MockQueryBuilder, [Partial<SupabaseQueryResult>]>;
  clone: jest.Mock<MockQueryBuilder, []>;
  execute: jest.Mock<Promise<SupabaseQueryResult>, []>;
} & {
  [K in ChainableMethod]: jest.Mock<MockQueryBuilder, []>;
};

const createQueryResult = (overrides?: Partial<SupabaseQueryResult>): SupabaseQueryResult => ({
  data: null,
  error: null,
  ...overrides,
});

const createQueryBuilder = (initialResult?: Partial<SupabaseQueryResult>) => {
  let resolved = createQueryResult(initialResult);
  const builder = {} as MockQueryBuilder;

  const resolveWith = (result: Partial<SupabaseQueryResult>) => {
    resolved = createQueryResult(result);
    return builder;
  };

  const asPromise = () => Promise.resolve(resolved);

  builder.__setResponse = resolveWith;
  builder.then = (onFulfilled, onRejected) => asPromise().then(onFulfilled, onRejected);
  builder.catch = (onRejected) => asPromise().catch(onRejected);
  builder.finally = (onFinally) => asPromise().finally(onFinally);

  SUPABASE_CHAINABLE_METHODS.forEach((method) => {
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
  const mock = {
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
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');

  return {
    ...actual,
    useNavigate: jest.fn(() => jest.fn()),
    useParams: jest.fn(() => ({})),
    useSearchParams: jest.fn(() => [new URLSearchParams(), jest.fn()] as const),
  };
});

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
