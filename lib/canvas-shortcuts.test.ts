import { describe, expect, it } from "vitest";

import { resolveCanvasShortcut } from "./canvas-shortcuts";

function ev(over: Partial<Parameters<typeof resolveCanvasShortcut>[0]> = {}) {
  return { key: "z", ctrlKey: false, metaKey: false, shiftKey: false, ...over };
}

describe("resolveCanvasShortcut", () => {
  it("Ctrl+Z → undo", () => {
    expect(resolveCanvasShortcut(ev({ ctrlKey: true }), { isEditingText: false })).toBe("undo");
  });

  it("Cmd+Z (macOS) → undo", () => {
    expect(resolveCanvasShortcut(ev({ metaKey: true }), { isEditingText: false })).toBe("undo");
  });

  it("Ctrl+Shift+Z → redo", () => {
    expect(resolveCanvasShortcut(ev({ ctrlKey: true, shiftKey: true }), { isEditingText: false })).toBe("redo");
  });

  it("Ctrl+Y → redo", () => {
    expect(resolveCanvasShortcut(ev({ key: "y", ctrlKey: true }), { isEditingText: false })).toBe("redo");
  });

  it("acceptă și tasta majusculă (Shift/CapsLock schimbă event.key)", () => {
    expect(resolveCanvasShortcut(ev({ key: "Z", ctrlKey: true }), { isEditingText: false })).toBe("undo");
  });

  it("Z fără modificator → nimic (nu fură tasta din desen)", () => {
    expect(resolveCanvasShortcut(ev(), { isEditingText: false })).toBeNull();
  });

  it("altă tastă cu Ctrl (ex. Ctrl+S) → nimic", () => {
    expect(resolveCanvasShortcut(ev({ key: "s", ctrlKey: true }), { isEditingText: false })).toBeNull();
  });

  it("Ctrl+Shift+Y → nimic (nu e o convenție de redo)", () => {
    expect(resolveCanvasShortcut(ev({ key: "y", ctrlKey: true, shiftKey: true }), { isEditingText: false })).toBeNull();
  });

  it("în timpul editării de text, Ctrl+Z NU declanșează undo pe desen (rămâne undo-ul nativ al casetei)", () => {
    expect(resolveCanvasShortcut(ev({ ctrlKey: true }), { isEditingText: true })).toBeNull();
    expect(resolveCanvasShortcut(ev({ ctrlKey: true, shiftKey: true }), { isEditingText: true })).toBeNull();
    expect(resolveCanvasShortcut(ev({ key: "y", ctrlKey: true }), { isEditingText: true })).toBeNull();
  });
});
