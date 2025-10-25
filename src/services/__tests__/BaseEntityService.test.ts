jest.mock("@/lib/organizationUtils", () => ({
  getUserOrganizationId: jest.fn(),
}));

jest.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

import { BaseEntityService } from "../BaseEntityService";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { supabase } from "@/integrations/supabase/client";

const getUserOrganizationIdMock = getUserOrganizationId as jest.Mock;
const supabaseGetUserMock = supabase.auth.getUser as jest.Mock;

class TestService extends BaseEntityService {
  public async exposeGetOrganizationId() {
    return this.getOrganizationId();
  }

  public async exposeGetAuthenticatedUser() {
    return this.getAuthenticatedUser();
  }
}

describe("BaseEntityService", () => {
  const service = new TestService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrganizationId", () => {
    it("returns organization id when lookup succeeds", async () => {
      getUserOrganizationIdMock.mockResolvedValueOnce("org-123");

      const result = await service.exposeGetOrganizationId();

      expect(result).toBe("org-123");
      expect(getUserOrganizationIdMock).toHaveBeenCalledTimes(1);
    });

    it("returns null and logs error when lookup throws", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
      getUserOrganizationIdMock.mockRejectedValueOnce(new Error("boom"));

      const result = await service.exposeGetOrganizationId();

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        "Error getting organization ID:",
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });
  });

  describe("getAuthenticatedUser", () => {
    it("returns the authenticated user when present", async () => {
      supabaseGetUserMock.mockResolvedValueOnce({
        data: { user: { id: "user-1", email: "test@example.com" } },
      });

      const user = await service.exposeGetAuthenticatedUser();

      expect(user).toEqual({ id: "user-1", email: "test@example.com" });
    });

    it("throws when no authenticated user exists", async () => {
      supabaseGetUserMock.mockResolvedValueOnce({ data: { user: null } });

      await expect(service.exposeGetAuthenticatedUser()).rejects.toThrow(
        "No authenticated user"
      );
    });
  });
});
