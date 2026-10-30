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

type Props = { children?: ReactNode; src?: string; onError?: () => void; className?: string; style?: { transform: string };
  onTransitionEnd?: () => void; onPointerEnter?: (event: { pointerType: string }) => void; onPointerLeave?: () => void };
function collect(node: ReactNode, match: (props: Props) => boolean): Props[] {
  if (!isValidElement<Props>(node)) return [];
  return [...(match(node.props) ? [node.props] : []), ...Children.toArray(node.props.children).flatMap((child) => collect(child, match))];
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
  const images = collect(tree, (p) => !!p.src);
  const track = collect(tree, (p) => !!p.onTransitionEnd)[0];
  return { tree, images, srcs: images.map((image) => image.src), track, offset: track.style!.transform };
}
beforeEach(() => {
  hooks.states = []; hooks.effect = undefined;
  vi.useFakeTimers();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
});
afterEach(() => { hooks.effect?.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });

// "La hover peste un detaliu in feed sa fie o succesiune a schitelor din interiorul detaliului in loop"
// "as vrea ca acel hover din feed, sa nu fie asa brusca schimbarea -- adica as vrea ceva ca un slide effect"
it("gliseaza foile in loop doar la hover si revine la baza la iesire", () => {
  let view = render();
  expect(view.srcs).toEqual(["/base.png"]);
  view.tree.props.onPointerEnter!({ pointerType: "mouse" }); view = render();
  expect(view.srcs).toEqual(["/base.png", "/first.png", "/api/files/sketch/s2", "/base.png"]);
  expect(view.offset).toBe("translateX(-0%)");
  vi.advanceTimersByTime(1500); view = render(); expect(view.offset).toBe("translateX(-100%)");
  expect(view.track.className).toContain("transition-transform");
  vi.advanceTimersByTime(1500); expect(render().offset).toBe("translateX(-200%)");
  vi.advanceTimersByTime(1500); view = render(); expect(view.offset).toBe("translateX(-300%)");
  view.track.onTransitionEnd!(); view = render();
  expect(view.offset).toBe("translateX(-0%)"); expect(view.track.className).toContain("transition-none");
  vi.advanceTimersByTime(1500); view = render();
  expect(view.offset).toBe("translateX(-100%)"); expect(view.track.className).toContain("transition-transform");
  // Fara transitionend pe copia bazei, timer-ul face saltul, ca loop-ul sa nu se opreasca.
  vi.advanceTimersByTime(1500); render();
  vi.advanceTimersByTime(1500); expect(render().offset).toBe("translateX(-300%)");
  vi.advanceTimersByTime(1500); view = render();
  expect(view.offset).toBe("translateX(-0%)"); expect(view.track.className).toContain("transition-none");
  vi.advanceTimersByTime(1500); expect(render().offset).toBe("translateX(-100%)");
  view.tree.props.onPointerLeave!(); view = render();
  expect(view.offset).toBe("translateX(-0%)"); expect(view.track.className).toContain("transition-transform");
  vi.advanceTimersByTime(4500); expect(render().offset).toBe("translateX(-0%)");
  expect(vi.getTimerCount()).toBe(0);
});
it("nu porneste pe touch, fara miniaturi sau cu reduced-motion", () => {
  render().tree.props.onPointerEnter!({ pointerType: "touch" }); render();
  expect(vi.getTimerCount()).toBe(0);
  expect(render().srcs).toEqual(["/base.png"]);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
  render().tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  expect(vi.getTimerCount()).toBe(0);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  render([]).tree.props.onPointerEnter!({ pointerType: "mouse" }); render([]);
  expect(vi.getTimerCount()).toBe(0);
});
it("opreste temporizatorul la eroare sau demontare", () => {
  render().tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  vi.advanceTimersByTime(1500); render().images[1].onError!();
  expect(render().offset).toBe("translateX(-0%)"); expect(vi.getTimerCount()).toBe(0);
  render().tree.props.onPointerEnter!({ pointerType: "mouse" }); render();
  hooks.effect?.cleanup?.(); expect(vi.getTimerCount()).toBe(0);
});
