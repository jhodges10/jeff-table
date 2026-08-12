import { afterEach, describe, expect, it } from "vitest";
import { createLocalStoragePreferenceStorage } from "./preferences";

describe("local preference storage", () => {
  const storage = createLocalStoragePreferenceStorage("test-grid:");

  afterEach(() => window.localStorage.clear());

  it("round-trips and removes preferences", () => {
    const preferences = {
      columnOrder: ["email", "name"],
      columnSizing: { name: 200 },
      columnVisibility: { email: false },
    };
    storage.save("people", preferences);
    expect(storage.load("people")).toEqual(preferences);
    storage.remove?.("people");
    expect(storage.load("people")).toBeUndefined();
  });
});
