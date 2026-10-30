import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

type Effect = { setup: () => void | (() => void); cleanup?: () => void; deps: unknown[]; changed: boolean };
const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0, effect: undefined as Effect | undefined }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = initial;
    return [hooks.states[index], (next: unknown) => {
      hooks.states[index] = typeof next === "function" ? next(hooks.states[index]) : next;
    }];
  },
  useEffect: (setup: Effect["setup"], deps: unknown[]) => {
    const old = hooks.effect;
    hooks.effect = { setup, deps, cleanup: old?.cleanup, changed: !old || deps.some((value, i) => !Object.is(value, old.deps[i])) };
  },
}));
vi.mock("next/image", () => ({ default: "img" }));
vi.mock("./feed-save-button", () => ({ FeedSaveButton: () => null }));
import { DetailCard } from "./detail-card";

type Props = { children?: ReactNode; src?: string; onError?: () => void;
  onPointerEnter?: (event: { pointerType: string }) => void; onPointerLeave?: () => void };
function findImage(node: ReactNode): ReactElement<Props> | undefined {
  if (!isValidElement<Props>(node)) return;
  if (node.props.src) return node;
  return Children.toArray(node.props.children).map(findImage).find(Boolean);
}
const props: ComponentProps<typeof DetailCard> = {
  detail: { id: "detail", title: "Detaliu", imageUrl: "/base.png", categories: [], interactorAvatars: [], interactorCount: 0 } as unknown as ComponentProps<typeof DetailCard>["detail"],
  sketchPreviews: [{ id: "s1", thumbnailUrl: "/first.png" }, { id: "s2", thumbnailUrl: "https://store.private.blob.vercel-storage.com/second.png" }],
};
function render(previews = props.sketchPreviews) {
  hooks.index = 0;
  const tree = DetailCard({ ...props, sketchPreviews: previews }) as ReactElement<Props>;
  const effect = hooks.effect!;
  if (effect.changed) { effect.cleanup?.(); effect.cleanup = effect.setup() || undefined; effect.changed = false; }
  return { tree, image: findImage(tree)!.props };
}
beforeEach(() => {
  hooks.states = []; hooks.effect = undefined;
  vi.useFakeTimers();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
});
afterEach(() => { hooks.effect?.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

// "La hover peste un detaliu in feed sa fie o succesiune a schitelor din interiorul detaliului in loop"
it("ruleaza foile in loop doar la hover si revine la baza la iesire", () => {
  let view = render();
  expect(view.image.src).toBe("/base.png");
  view.tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  vi.advanceTimersByTime(1500); view = render(); expect(view.image.src).toBe("/first.png");
  vi.advanceTimersByTime(1500); view = render(); expect(view.image.src).toBe("/api/files/sketch/s2");
  vi.advanceTimersByTime(1500); view = render(); expect(view.image.src).toBe("/base.png");
  view.tree.props.onPointerLeave!(); view = render();
  vi.advanceTimersByTime(4500); expect(render().image.src).toBe("/base.png");
  expect(vi.getTimerCount()).toBe(0);
});
it("nu porneste pe touch, fara miniaturi sau cu reduced-motion", () => {
  render().tree.props.onPointerEnter!({ pointerType: "touch" }); render();
  expect(vi.getTimerCount()).toBe(0);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  render().tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  expect(vi.getTimerCount()).toBe(0);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  render([]).tree.props.onPointerEnter!({ pointerType: "mouse" }); render([]);
  expect(vi.getTimerCount()).toBe(0);
});
it("opreste temporizatorul la eroare sau demontare", () => {
  render().tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  vi.advanceTimersByTime(1500); render().image.onError!();
  expect(render().image.src).toBe("/base.png"); expect(vi.getTimerCount()).toBe(0);
  render().tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  hooks.effect?.cleanup?.(); expect(vi.getTimerCount()).toBe(0);
});
