"use client";

import * as OBC from "@thatopen/components";
import { useEffect, useRef, useState } from "react";

// Viewer 3D pentru resursele CAD `.ifc` — That Open Engine (web-ifc + fragments peste three.js).
// WASM-ul și worker-ul sunt servite de noi din /ifc/ (scripts/copy-ifc-assets.mjs), NU de pe unpkg:
// CSP-ul nu primește un CDN extern și versiunea e mereu cea instalată. Încărcat DOAR prin
// `dynamic()` din resource-ifc.tsx, deci three.js nu intră în bundle-ul paginii.
export function IfcViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const components = new OBC.Components();
    const world = components.get(OBC.Worlds).create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
    world.scene = new OBC.SimpleScene(components);
    world.scene.setup();
    world.renderer = new OBC.SimpleRenderer(components, container);
    world.camera = new OBC.SimpleCamera(components);
    components.init();

    const fragments = components.get(OBC.FragmentsManager);
    fragments.init("/ifc/fragments-worker.mjs");
    world.camera.controls.addEventListener("update", () => fragments.core.update());
    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      fragments.core.update(true);
    });

    async function load() {
      const ifcLoader = components.get(OBC.IfcLoader);
      await ifcLoader.setup({ autoSetWasm: false, wasm: { path: "/ifc/", absolute: false } });
      const res = await fetch(url);
      if (!res.ok) throw new Error(`IFC_FETCH_${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (disposed) return;
      await ifcLoader.load(bytes, true, "model");
      if (disposed) return;
      await world.camera.fitToItems();
      setStatus("ready");
    }

    load().catch(() => {
      if (!disposed) setStatus("error");
    });

    return () => {
      disposed = true;
      components.dispose();
    };
  }, [url]);

  return (
    <div className="relative size-full" data-testid="ifc-viewer" data-status={status}>
      <div ref={containerRef} className="size-full" />
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-white/80">
          Se încarcă modelul 3D…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
          Nu am putut deschide modelul.
        </div>
      )}
    </div>
  );
}
