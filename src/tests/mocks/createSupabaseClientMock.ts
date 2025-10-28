import type { PostgrestSingleResponse } from "@supabase/supabase-js";

export type QueryBuilderMock<TData = any> = {
  select: jest.Mock<QueryBuilderMock<TData>, [string?]>;
  eq: jest.Mock<QueryBuilderMock<TData>, [string, any]>;
  limit: jest.Mock<QueryBuilderMock<TData>, [number]>;
  order: jest.Mock<QueryBuilderMock<TData>, [string, { ascending?: boolean }?]>;
  maybeSingle: jest.Mock<Promise<PostgrestSingleResponse<TData>>, []>;
  single: jest.Mock<Promise<PostgrestSingleResponse<TData>>, []>;
  insert: jest.Mock<Promise<PostgrestSingleResponse<TData>>, [any]>;
  update: jest.Mock<Promise<PostgrestSingleResponse<TData>>, [any]>;
  delete: jest.Mock<Promise<PostgrestSingleResponse<TData>>, []>;
};

export const createQueryBuilderMock = <TData = any>(): QueryBuilderMock<TData> => {
  const builder: Partial<QueryBuilderMock<TData>> = {};

  const chain = () => builder as QueryBuilderMock<TData>;
  const resolve =
    (data: TData | null = null, error: PostgrestSingleResponse<TData>["error"] = null) =>
    async () =>
      ({
        data,
        error,
        status: error ? 500 : 200,
        statusText: error ? "Error" : "OK",
      }) as PostgrestSingleResponse<TData>;

  builder.select = jest.fn(() => chain());
  builder.eq = jest.fn(() => chain());
  builder.limit = jest.fn(() => chain());
  builder.order = jest.fn(() => chain());
  builder.maybeSingle = jest.fn(resolve());
  builder.single = jest.fn(resolve());
  builder.insert = jest.fn(resolve());
  builder.update = jest.fn(resolve());
  builder.delete = jest.fn(resolve());

  return builder as QueryBuilderMock<TData>;
};

export interface SupabaseClientMock {
  auth: {
    getUser: jest.Mock<Promise<{ data: { user: { id: string } | null }; error: null }>, []>;
  };
  rpc: jest.Mock;
  from: jest.Mock<QueryBuilderMock, [string]>;
  storage: {
    from: jest.Mock;
  };
}

export interface SupabaseMockController {
  supabase: SupabaseClientMock;
  reset: () => void;
  setTableMock: <TData = any>(table: string, builder?: QueryBuilderMock<TData>) => QueryBuilderMock<TData>;
  getTableMock: <TData = any>(table: string) => QueryBuilderMock<TData>;
  tables: Map<string, QueryBuilderMock>;
}

export const createSupabaseClientMock = (): SupabaseMockController => {
  const tables = new Map<string, QueryBuilderMock>();

  const getOrCreateBuilder = (table: string) => {
    if (!tables.has(table)) {
      tables.set(table, createQueryBuilderMock());
    }
    return tables.get(table)!;
  };

  const supabase: SupabaseClientMock = {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: { id: "supabase-test-user" } }, error: null })),
    },
    rpc: jest.fn(),
    from: jest.fn((table: string) => getOrCreateBuilder(table)),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        remove: jest.fn(),
        list: jest.fn(),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: "" } })),
      })),
    },
  };

  const reset = () => {
    supabase.auth.getUser.mockReset();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "supabase-test-user" } }, error: null });
    supabase.rpc.mockReset();
    supabase.from.mockReset();
    supabase.storage.from.mockReset();
    tables.clear();
  };

  const setTableMock = <TData = any>(table: string, builder?: QueryBuilderMock<TData>) => {
    const target = (builder ?? createQueryBuilderMock<TData>()) as QueryBuilderMock;
    tables.set(table, target);
    return target as QueryBuilderMock<TData>;
  };

  const getTableMock = <TData = any>(table: string) => getOrCreateBuilder(table) as QueryBuilderMock<TData>;

  return {
    supabase,
    reset,
    setTableMock,
    getTableMock,
    tables,
  };
};
