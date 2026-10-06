import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Test de unitate pentru handler/stare; nu înlocuiește verificarea interacțiunii din browser.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useId: () => "drawing-unit", useState: vi.fn() };
});

import { AnimatedAuthDrawing } from "@/components/public-pages/animated-auth-drawing";

type ElementProps = { children?: ReactNode; onClick?: () => void; type?: string };
function findButton(node: ReactNode): ReactElement<ElementProps> | undefined {
  if (!isValidElement<ElementProps>(node)) return undefined;
  if (node.type === "button") return node;
  return Children.toArray(node.props.children).map(findButton).find(Boolean);
}

describe("Controlul animației — unitate", () => {
  const setPaused = vi.fn();
  beforeEach(() => {
    setPaused.mockClear();
  });

  it.each([false, true])("inversează starea %s prin updater funcțional, fără submit", (paused) => {
    vi.mocked(useState).mockReturnValue([paused, setPaused]);
    const drawing = AnimatedAuthDrawing();
    expect(drawing.props["data-paused"]).toBe(paused);
    const button = findButton(drawing);
    expect(button?.props.type).toBe("button");
    expect(Children.toArray(button?.props.children)).toContain(
      paused ? "Reia animația" : "Pauză animație",
    );
    button?.props.onClick?.();
    expect(setPaused).toHaveBeenCalledOnce();
    const updater = setPaused.mock.calls[0][0] as (current: boolean) => boolean;
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });
});
