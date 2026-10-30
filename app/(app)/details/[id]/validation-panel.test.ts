import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [hooks.states[index], (value: unknown) => { hooks.states[index] = value; }];
  },
  useActionState: () => [{ error: null }, vi.fn(), false],
  useOptimistic: (value: unknown) => [value, vi.fn()],
  startTransition: (callback: () => void) => callback(),
}));
vi.mock("react-dom", () => ({ createPortal: vi.fn((children: ReactNode) => children) }));
vi.mock("./validation-actions", () => ({ approveAction: vi.fn(), disapproveAction: vi.fn(), retractAction: vi.fn() }));
vi.mock("./sketch-review-actions", () => ({ startSketchAction: vi.fn() }));

import { approveAction, disapproveAction, retractAction } from "./validation-actions";
import { ValidationPanel } from "./validation-panel";

type Props = { children?: ReactNode; "aria-label"?: string; "aria-pressed"?: boolean; "data-testid"?: string; ariaLabel?: string; href?: string; onClick?: () => void; onClose?: () => void };
function find(node: ReactNode, predicate: (element: ReactElement<Props>) => boolean): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (predicate(node)) return node;
  return Children.toArray(node.props.children).map((child) => find(child, predicate)).find(Boolean);
}
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<Props>(node)) return textOf(node.props.children);
  return Children.toArray(node).map(textOf).join("");
}
const position = { createdAt: new Date("2026-10-30T10:00:00Z"), userImage: null, roleMain: "PROIECTANT", subRole: "ARHITECT", verification: null };
const props: ComponentProps<typeof ValidationPanel> = {
  targetType: "DETAIL", targetId: "detail-1", detailId: "detail-1", allowSketch: true,
  counts: { approve: 1, disapprove: 1 }, myPosition: null, embedded: true,
  voteSlot: {} as Element,
  positions: [
    { ...position, userId: "u1", userName: "Autor aprobare", position: "APPROVE" },
    { ...position, userId: "u2", userName: "Autor dezaprobare", position: "DISAPPROVE" },
  ],
};
function render(overrides: Partial<typeof props> = {}) {
  hooks.index = 0;
  return ValidationPanel({ ...props, ...overrides });
}
beforeEach(() => { hooks.states = []; hooks.index = 0; vi.clearAllMocks(); vi.stubGlobal("document", { body: {} }); });
afterEach(() => { vi.unstubAllGlobals(); });

// "click pe numarul dintre sageti deschide un modal cu Aprobari si Dezaprobari"
it("lista nu apare sub desen, iar numarul deschide aprobarile fara sa trimita un vot", () => {
  let tree = render();
  expect(find(tree, (node) => node.props["data-testid"] === "validation-positions-list")).toBeUndefined();
  expect(textOf(tree)).not.toContain("Autor aprobare");
  const count = find(tree, (node) => node.props["aria-label"] === "Vezi validările")!;
  expect(textOf(count)).toBe("2");
  count.props.onClick!();
  tree = render();
  expect(find(tree, (node) => node.props.ariaLabel === "Validări")).toBeDefined();
  expect(textOf(tree)).toContain("Autor aprobare");
  expect(textOf(tree)).not.toContain("Autor dezaprobare");
  expect(createPortal).toHaveBeenLastCalledWith(expect.anything(), document.body);
  expect(approveAction).not.toHaveBeenCalled();
  expect(disapproveAction).not.toHaveBeenCalled();
  expect(retractAction).not.toHaveBeenCalled();
});

it("schimba doar categoria afisata si inchide modalul din controlul existent", () => {
  find(render(), (node) => node.props["aria-label"] === "Vezi validările")!.props.onClick!();
  let tree = render();
  find(tree, (node) => node.type === "button" && textOf(node) === "Dezaprobări (1)")!.props.onClick!();
  tree = render();
  expect(textOf(tree)).toContain("Autor dezaprobare");
  expect(textOf(tree)).not.toContain("Autor aprobare");
  expect(find(tree, (node) => node.type === "button" && textOf(node) === "Dezaprobări (1)")!.props["aria-pressed"]).toBe(true);
  find(tree, (node) => node.props.ariaLabel === "Validări")!.props.onClose!();
  expect(find(render(), (node) => node.props.ariaLabel === "Validări")).toBeUndefined();
});

it("are stare goala si ramane accesibil celui care nu poate vota", () => {
  find(render({ canValidate: false, voteSlot: null }), (node) => node.props["aria-label"] === "Vezi validările")!.props.onClick!();
  const tree = render({ canValidate: false, voteSlot: null, positions: [], counts: { approve: 0, disapprove: 0 } });
  expect(textOf(tree)).toContain("Nicio aprobare încă.");
  expect(find(tree, (node) => node.props["aria-label"] === "Aprobă")).toBeUndefined();
});

// "Sper ca nu ai schimbat vreo logica.. ci doar te-ai axat pe UI/UX."
// "Aprob = 1 click. Dezaprob = justificare OBLIGATORIE (altfel respins) → devine automat un Comment."
it("pastreaza actiunea si tinta aprobarii, inclusiv fara portalul de vot", () => {
  const tree = render({ voteSlot: null });
  find(tree, (node) => node.props["aria-label"] === "Aprobă")!.props.onClick!();
  expect(approveAction).toHaveBeenCalledTimes(1);
  const data = vi.mocked(approveAction).mock.calls[0][0] as FormData;
  expect([...data.entries()]).toEqual([["targetType", "DETAIL"], ["targetId", "detail-1"], ["detailId", "detail-1"]]);
});

it("pastreaza alegerea text/schita pe detaliu si justificarea directa pe schita", () => {
  find(render(), (node) => node.props["aria-label"] === "Dezaprobă")!.props.onClick!();
  expect(textOf(render())).toContain("Cum vrei să dezaprobi?");
  hooks.states = [];
  find(render({ targetType: "SKETCH", targetId: "sketch-1", allowSketch: false }), (node) => node.props["aria-label"] === "Dezaprobă")!.props.onClick!();
  const sketchTree = render({ targetType: "SKETCH", targetId: "sketch-1", allowSketch: false });
  expect(textOf(sketchTree)).toContain("Justificare (obligatorie)");
  expect(textOf(sketchTree)).not.toContain("Cum vrei să dezaprobi?");
});
