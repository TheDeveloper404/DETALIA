"use client";

import * as OBC from "@thatopen/components";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";

// Viewer 3D pentru resursele CAD `.ifc` — That Open Engine (web-ifc + fragments peste three.js).
// WASM-ul și worker-ul sunt servite de noi din /ifc/ (copiate de next.config.ts), NU de pe unpkg:
// CSP-ul nu primește un CDN extern și versiunea e mereu cea instalată. Încărcat DOAR prin
// `dynamic()` din resource-ifc.tsx, deci three.js nu intră în bundle-ul paginii.
export function IfcViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    // Închiderea viewer-ului oprește și descărcarea IFC-ului (pot fi zeci de MB pe mobil).
    const abort = new AbortController();

    const components = new OBC.Components();

    // Tot setup-ul (inclusiv renderer-ul WebGL, care aruncă pe dispozitive fără WebGL) e sub același
    // `catch` → mesajul „Nu am putut deschide modelul", nu o excepție care strică pagina detaliului.
    async function load(el: HTMLDivElement) {
      const world = components.get(OBC.Worlds).create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
      world.scene = new OBC.SimpleScene(components);
      world.scene.setup();
      world.renderer = new OBC.SimpleRenderer(components, el);
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

      const ifcLoader = components.get(OBC.IfcLoader);
      // `absolute: true` = calea e luată ca atare (/ifc/web-ifc.wasm de pe domeniul nostru). Cu `false`,
      // web-ifc o prefixează cu directorul script-ului (/_next/static/chunks//ifc/…) → 404.
      await ifcLoader.setup({ autoSetWasm: false, wasm: { path: "/ifc/", absolute: true } });
      if (disposed) return;
      const res = await fetch(url, { signal: abort.signal });
      if (!res.ok) throw new Error(`IFC_FETCH_${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (disposed) return;
      await ifcLoader.load(bytes, true, "model");
      if (disposed) return;
      await world.camera.fitToItems();
      setStatus("ready");
    }

    load(container).catch((err) => {
      // După închidere (inclusiv abort-ul descărcării) nu e o eroare de raportat.
      if (disposed) return;
      posthog.captureException(err);
      setStatus("error");
    });

    return () => {
      disposed = true;
      abort.abort();
      try {
        components.dispose();
      } catch {
        // Setup-ul a eșuat înainte de cameră (ex. fără WebGL) → `SimpleWorld.dispose()` aruncă
        // „No camera initialized!"; nu avem nimic alocat pe GPU, iar demontarea nu trebuie să strice pagina.
      }
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
