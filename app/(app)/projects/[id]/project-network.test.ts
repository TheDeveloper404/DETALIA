import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const { setters, initialValues, regenerate, rename, share, rethrow } = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  initialValues: [] as unknown[],
  regenerate: vi.fn(), rename: vi.fn(), share: vi.fn(), rethrow: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (value: unknown) => {
    const index = setters.length;
    const setter = vi.fn();
    setters.push(setter);
    return [index in initialValues ? initialValues[index] : typeof value === "function" ? value() : value, setter];
  },
  useSyncExternalStore: () => "https://detalia.test",
  useRef: () => ({ current: null }),
  useEffect: vi.fn(),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: rethrow }));
vi.mock("../actions", () => ({ regenerateInviteLinkAction: regenerate, renameProjectAction: rename, shareCanvasAction: share }));

import { ContentGrid } from "./content-grid";
import { EditableProjectName } from "./editable-project-name";
import { InviteLinkBox } from "./project-panel";

type NodeProps = { children?: ReactNode; onClick?: () => Promise<void>; onKeyDown?: (event: unknown) => void };
function find(node: ReactNode, predicate: (node: ReactElement<NodeProps>) => boolean): ReactElement<NodeProps> | undefined {
  if (!isValidElement<NodeProps>(node)) return;
  if (predicate(node)) return node;
  return Children.toArray(node.props.children).map((child) => find(child, predicate)).find(Boolean);
}

beforeEach(() => { setters.length = 0; initialValues.length = 0; vi.resetAllMocks(); });

// Regula aprobata: "Erori de retea: trei componente din proiecte pot lasa butoane blocate" — "Da trebuie rezolvat acum."
it.each([new Error("offline"), undefined])("regenerarea invitației afișează eroarea și eliberează pending: %s", async (failure) => {
  if (failure) regenerate.mockRejectedValueOnce(failure); else regenerate.mockResolvedValueOnce(undefined);
  const tree = InviteLinkBox({ projectId: "project", initialToken: "old" });
  const button = find(tree, (node) => node.props.onClick !== undefined && Children.toArray(node.props.children).includes("Regenerează"));
  await button!.props.onClick!();
  expect(setters[2]).toHaveBeenLastCalledWith(false);
  expect(setters[3]).toHaveBeenLastCalledWith("Nu am putut regenera linkul. Încearcă din nou.");
  expect(setters[0]).not.toHaveBeenCalled();
});

// Regula aprobata: "Erori de retea: trei componente din proiecte pot lasa butoane blocate" — "Da trebuie rezolvat acum."
it("redenumirea păstrează editarea și afișează eroarea de transport", async () => {
  initialValues[1] = true;
  initialValues[2] = "Nume nou";
  rename.mockRejectedValueOnce(new Error("offline"));
  const tree = EditableProjectName({ projectId: "project", initialName: "Nume vechi", editable: true });
  find(tree, (node) => node.type === "input")!.props.onKeyDown!({ key: "Enter", preventDefault: vi.fn() });
  await vi.waitFor(() => expect(setters[3]).toHaveBeenCalledWith("Nu am putut redenumi proiectul. Încearcă din nou."));
  expect(setters[0]).not.toHaveBeenCalled();
  expect(setters[1]).not.toHaveBeenCalledWith(false);
});

// Regula aprobata: "Erori de retea: trei componente din proiecte pot lasa butoane blocate" — "Da trebuie rezolvat acum."
it("partajarea unei planșe permite reîncercarea după eșec", async () => {
  initialValues[0] = true;
  const grid = ContentGrid({ projectId: "project", isMember: true, details: [], releasedDetails: [], canvasShares: [], myCanvases: [{ id: "canvas", name: "Plan", thumbnailUrl: null }], isOwner: true, currentUserId: "user" });
  const modal = find(grid, (node) => typeof node.type === "function" && node.type.name === "AddContentModal")!;
  setters.length = 0;
  initialValues[0] = "canvas";
  share.mockRejectedValueOnce(new Error("offline"));
  const tree = (modal.type as (props: unknown) => ReactNode)(modal.props);
  const button = find(tree, (node) => node.props.onClick !== undefined && Children.toArray(node.props.children).some((child) => isValidElement<{ children?: ReactNode }>(child) && child.props.children === "Plan"));
  await button!.props.onClick!();
  expect(setters[1]).toHaveBeenLastCalledWith(null);
  expect(setters[2]).toHaveBeenLastCalledWith("Nu am putut partaja planșa. Încearcă din nou.");
});

it("păstrează excepțiile de redirect ale framework-ului și eliberează pending", async () => {
  const redirect = new Error("redirect control flow");
  regenerate.mockRejectedValueOnce(redirect);
  rethrow.mockImplementationOnce(() => { throw redirect; });
  const tree = InviteLinkBox({ projectId: "project", initialToken: "old" });
  const button = find(tree, (node) => node.props.onClick !== undefined && Children.toArray(node.props.children).includes("Regenerează"));
  await expect(button!.props.onClick!()).rejects.toBe(redirect);
  expect(setters[2]).toHaveBeenLastCalledWith(false);
  expect(setters[3]).not.toHaveBeenCalledWith(expect.any(String));
});
