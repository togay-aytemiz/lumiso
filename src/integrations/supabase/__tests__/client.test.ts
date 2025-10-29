jest.unmock("@/integrations/supabase/client");

const createClientMock = jest.fn();

type LoadOptions = {
  getUser?: jest.Mock;
  onAuthStateChange?: jest.Mock;
};

const path = require("path");
const fs = require("fs");
const { transformSync } = require("@swc/core");

const CLIENT_PATH = path.resolve(__dirname, "..", "client.ts");

const loadClient = async (options: LoadOptions = {}) => {
  createClientMock.mockReset();

  const unsubscribe = jest.fn();
  const getUser =
    options.getUser ??
    jest.fn().mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
  const onAuthStateChange =
    options.onAuthStateChange ??
    jest.fn().mockReturnValue({
      data: {
        subscription: { unsubscribe },
      },
    });

  createClientMock.mockReturnValue({
    auth: {
      getUser,
      onAuthStateChange,
    },
  });

  const source = fs.readFileSync(CLIENT_PATH, "utf8").replace(/import\.meta/g, "undefined");
  const { code } = transformSync(source, {
    filename: CLIENT_PATH,
    jsc: {
      parser: { syntax: "typescript" },
      target: "es2019",
    },
    module: {
      type: "commonjs",
    },
  });

  const moduleExports = {};
  const moduleObj = { exports: moduleExports };
  const localRequire = (id: string) => {
    if (id === "@supabase/supabase-js") {
      return { createClient: createClientMock };
    }
    if (id === "./types") {
      return {};
    }
    return require(id);
  };

  const wrapped = new Function("require", "module", "exports", "__filename", "__dirname", code);
  wrapped(localRequire, moduleObj, moduleExports, CLIENT_PATH, path.dirname(CLIENT_PATH));

  const supabase = moduleObj.exports.supabase as unknown as { auth: { getUser: jest.Mock } };

  return { supabase, getUser, onAuthStateChange, unsubscribe };
};

describe("supabase client wrapper", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("initializes Supabase client with persisted auth configuration", async () => {
    const { onAuthStateChange } = await loadClient();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = (createClientMock as jest.Mock).mock.calls[0];
    expect(url).toBe("https://rifdykpdubrowzbylffe.supabase.co");
    expect(typeof key).toBe("string");
    expect(options.auth.persistSession).toBe(true);
    expect(options.auth.autoRefreshToken).toBe(true);
    expect(options.auth.storage).toBe(window.localStorage);
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(typeof onAuthStateChange.mock.calls[0][0]).toBe("function");
  });

  it("reuses cached getUser responses within TTL and refreshes afterwards", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(0);
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: "cached-user" } },
      error: null,
    });

    const { supabase } = await loadClient({ getUser });

    await supabase.auth.getUser();
    expect(getUser).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(15_000);
    await supabase.auth.getUser();
    expect(getUser).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(65_000);
    await supabase.auth.getUser();
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("deduplicates inflight getUser requests", async () => {
    let resolveOriginal: (value: unknown) => void = () => {};
    const originalPromise = new Promise((resolve) => {
      resolveOriginal = resolve;
    });
    const getUser = jest.fn().mockReturnValue(originalPromise);
    const { supabase } = await loadClient({ getUser });

    const firstCall = supabase.auth.getUser();
    const secondCall = supabase.auth.getUser();

    expect(getUser).toHaveBeenCalledTimes(1);

    resolveOriginal({
      data: { user: { id: "resolved-user" } },
      error: null,
    });
    await expect(firstCall).resolves.toEqual({
      data: { user: { id: "resolved-user" } },
      error: null,
    });
    await expect(secondCall).resolves.toEqual({
      data: { user: { id: "resolved-user" } },
      error: null,
    });
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("does not cache null users", async () => {
    const getUser = jest
      .fn()
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({ data: { user: { id: "fresh-user" } }, error: null });

    const { supabase } = await loadClient({ getUser });

    await supabase.auth.getUser();
    await supabase.auth.getUser();

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("updates cached user when auth listener fires", async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: "initial" } },
      error: null,
    });
    const { supabase, onAuthStateChange } = await loadClient({ getUser });

    await supabase.auth.getUser();
    const listener = onAuthStateChange.mock.calls[0][0] as (event: string, session: { user: unknown } | null) => void;
    getUser.mockClear();

    listener("TOKEN_REFRESHED", { user: { id: "from-event" } });

    const result = await supabase.auth.getUser();
    expect(getUser).not.toHaveBeenCalled();
    expect(result.data.user?.id).toBe("from-event");
  });

  it("returns error payloads when getUser rejects", async () => {
    const failure = new Error("network");
    const getUser = jest
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ data: { user: { id: "recovered" } }, error: null });

    const { supabase } = await loadClient({ getUser });

    const first = await supabase.auth.getUser();
    expect(first).toEqual({
      data: { user: null },
      error: failure,
    });

    const second = await supabase.auth.getUser();
    expect(second.data.user?.id).toBe("recovered");
  });
});
