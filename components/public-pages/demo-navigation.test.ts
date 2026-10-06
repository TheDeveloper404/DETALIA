import { describe, expect, it } from "vitest";
import { nextDemoTabId } from "./demo-navigation";

describe("Navigația taburilor demonstrative", () => {
  const ids = ["detail", "sketch", "arguments"] as const;
  it("avansează și revine circular, folosind id-ul stabil", () => {
    expect(nextDemoTabId(ids, "detail", "ArrowRight")).toBe("sketch");
    expect(nextDemoTabId(ids, "arguments", "ArrowRight")).toBe("detail");
    expect(nextDemoTabId(ids, "detail", "ArrowLeft")).toBe("arguments");
  });
  it("Home și End aleg capetele listei", () => {
    expect(nextDemoTabId(ids, "sketch", "Home")).toBe("detail");
    expect(nextDemoTabId(ids, "sketch", "End")).toBe("arguments");
  });
  it("suportă și săgețile verticale pentru lista de perspective", () => {
    expect(nextDemoTabId(ids, "detail", "ArrowDown")).toBe("sketch");
    expect(nextDemoTabId(ids, "detail", "ArrowUp")).toBe("arguments");
  });
  it("nu capturează Tab, Enter sau taste fără rol în navigație", () => {
    for (const key of ["Tab", "Enter", "Escape", "a"])
      expect(nextDemoTabId(ids, "detail", key)).toBeNull();
  });
  it("gestionează listele goale sau cu un singur tab", () => {
    expect(nextDemoTabId([], "detail", "Home")).toBeNull();
    expect(nextDemoTabId(["detail"], "detail", "ArrowRight")).toBe("detail");
  });
});
