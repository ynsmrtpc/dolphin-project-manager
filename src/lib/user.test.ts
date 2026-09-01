import { describe, expect, it } from "vitest";

import type { UserRow } from "@/lib/db";
import { toSessionUser } from "@/lib/user";

const row: UserRow = {
  id: 1,
  github_id: 42,
  login: "tester",
  name: "Test Eden",
  avatar_url: "https://example.com/a.png",
  access_token: "gho_cok_gizli_token",
};

describe("toSessionUser", () => {
  it("istemciye yalnızca güvenli alanları verir", () => {
    expect(toSessionUser(row)).toEqual({
      login: "tester",
      name: "Test Eden",
      avatarUrl: "https://example.com/a.png",
    });
  });

  /**
   * Bu bilesen istemciye seri hale getirilerek gidiyor.
   * Token'in sizmasi dogrudan guvenlik acigi olur.
   */
  it("access token'ı hiçbir biçimde taşımaz", () => {
    const result = toSessionUser(row);

    expect(Object.keys(result)).not.toContain("access_token");
    expect(JSON.stringify(result)).not.toContain("gho_cok_gizli_token");
  });

  it("eksik alanları null olarak korur", () => {
    const result = toSessionUser({ ...row, name: null, avatar_url: null });
    expect(result).toEqual({ login: "tester", name: null, avatarUrl: null });
  });
});
