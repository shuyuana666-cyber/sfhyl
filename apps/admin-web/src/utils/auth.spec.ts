import { beforeEach, describe, expect, it, vi } from "vitest";

const permissionState = vi.hoisted(() => ({ values: [] as string[] }));

vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({ permissions: permissionState.values })
}));

import { hasPerms } from "./auth";

describe("hasPerms", () => {
  beforeEach(() => {
    permissionState.values = [];
  });

  it("checks one permission and requires every permission in an array", () => {
    permissionState.values = ["vehicle:view", "vehicle:update"];
    expect(hasPerms("vehicle:view")).toBe(true);
    expect(hasPerms("vehicle:delete")).toBe(false);
    expect(hasPerms(["vehicle:view", "vehicle:update"])).toBe(true);
    expect(hasPerms(["vehicle:view", "vehicle:delete"])).toBe(false);
  });

  it("honors the super administrator wildcard", () => {
    permissionState.values = ["*:*:*"];
    expect(hasPerms("settings:update")).toBe(true);
  });
});
