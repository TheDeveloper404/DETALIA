"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  Download,
  FileImage,
  Hammer,
  House,
  Layers,
  LockKeyhole,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Users,
  X,
} from "lucide-react";
import { RolePill } from "@/components/role-pill";
import { nextDemoTabId } from "./demo-navigation";
import styles from "./landing-experience.module.css";

type DemoTab<T extends string> = { id: T; label: string; hint?: string; icon?: ReactNode };
function DemoTabs<T extends string>({
  tabs,
  active,
  onChange,
  prefix,
  label,
  className,
}: {
  tabs: readonly DemoTab<T>[];
  active: T;
  onChange: (id: T) => void;
  prefix: string;
  label: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={listRef} className={className ?? styles.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${prefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${prefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const next = nextDemoTabId(
              tabs.map(({ id }) => id),
              active,
              event.key,
            );
            if (next === null) return;
            event.preventDefault();
            onChange(next);
            listRef.current
              ?.querySelector<HTMLButtonElement>(`[id="${prefix}-tab-${next}"]`)
              ?.focus();
          }}
        >
          {tab.icon}
          <span>
            {tab.label}
            {tab.hint && <small>{tab.hint}</small>}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function DemoFrame({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={frameRef}
      className={`${styles.demoFrame} ${className}`}
      data-entered={entered}
      aria-label={label}
    >
      {children}
    </div>
  );
}

function ExampleAuthor({ name, role, label }: { name: string; role: string; label: string }) {
  return (
    <div className={styles.exampleAuthor}>
      <span>
        {name} <small>· exemplu fictiv</small>
      </span>
      <RolePill roleMain={role} subRole={label} verified={false} />
    </div>
  );
}
const detailTabs = [
  {
    id: "detail",
    label: "01 — Detaliul",
    hint: "Pui întrebarea în context",
    icon: <FileImage size={22} aria-hidden="true" />,
  },
  {
    id: "sketch",
    label: "02 — Schița",
    hint: "Arăți unde intervii",
    icon: <Pencil size={22} aria-hidden="true" />,
  },
  {
    id: "arguments",
    label: "03 — Argumentele",
    hint: "Vezi cine susține ce",
    icon: <MessageSquare size={22} aria-hidden="true" />,
  },
] as const;
type DetailStep = (typeof detailTabs)[number]["id"];
export function DetailDemo() {
  const prefix = useId();
  const [step, setStep] = useState<DetailStep>("detail");
  const [original, setOriginal] = useState(false);
  function selectStep(id: DetailStep) {
    setStep(id);
    setOriginal(false);
    // Butonul „etapa următoare” dispare odată cu panoul; păstrăm focusul pe tabul nou.
    document.getElementById(`${prefix}-tab-${id}`)?.focus();
  }
  return (
    <DemoFrame label="Demonstrație detaliu, schiță și argumente">
      <DemoTabs
        tabs={detailTabs}
        active={step}
        onChange={selectStep}
        prefix={prefix}
        label="Etapele unui detaliu"
      />
      {detailTabs.map(({ id }) => (
        <div
          key={id}
          id={`${prefix}-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`${prefix}-tab-${id}`}
          tabIndex={0}
          hidden={step !== id}
          className={styles.detailPanel}
        >
          <figure className={styles.detailDrawing}>
            <div className={styles.drawingBar}>
              <span>TERASĂ / RACORD CU ATICUL</span>
              <span>{id === "detail" || original ? "DETALIU INIȚIAL" : "SCHIȚĂ ILUSTRATIVĂ"}</span>
            </div>
            <div className={styles.drawingPaper}>
              <Image
                src={
                  id === "detail" || original
                    ? "/landing/terrace-detail.webp"
                    : "/landing/terrace-sketch.webp"
                }
                alt={
                  id === "detail" || original
                    ? "Detaliu de terasă și atic, cu cote și șorț de tablă."
                    : "Schiță ilustrativă care încercuiește racordul aticului și îl marchează cu întrebarea Racordul?"
                }
                width={1200}
                height={800}
                sizes="(max-width: 900px) 100vw, 850px"
              />
            </div>
            <figcaption>
              <span>
                {id === "detail"
                  ? "Detaliul este punctul de plecare."
                  : "Schița rămâne legată de acest detaliu."}
              </span>
              {id !== "detail" && (
                <button
                  type="button"
                  aria-pressed={original}
                  onClick={() => setOriginal((value) => !value)}
                >
                  {original ? "Vezi schița" : "Vezi originalul"}{" "}
                  <Layers size={16} aria-hidden="true" />
                </button>
              )}
            </figcaption>
          </figure>
          <div className={styles.detailNarrative}>
            {id === "detail" ? (
              <>
                <p className={styles.eyebrow}>Publică detaliul</p>
                <h3>Unde se termină desenul și începe interpretarea?</h3>
                <ExampleAuthor name="Ana" role="PROIECTANT" label="Proiectant" />
                <blockquote>
                  „Cum clarificăm racordul dintre terasă și atic înainte de execuție?”
                </blockquote>
                <p>
                  Publici desenul și explici ce vrei discutat. Ceilalți pornesc de la aceeași
                  imagine, nu de la o descriere aproximativă.
                </p>
                <button
                  type="button"
                  className={styles.nextStep}
                  onClick={() => selectStep("sketch")}
                >
                  Vezi contribuția unui executant <ArrowRight size={18} aria-hidden="true" />
                </button>
              </>
            ) : id === "sketch" ? (
              <>
                <p className={styles.eyebrow}>Primește schițe</p>
                <h3>O intervenție se vede. Nu trebuie ghicită.</h3>
                <ExampleAuthor name="Mihai" role="EXECUTANT" label="Executant" />
                <blockquote>
                  „Am marcat zona în care aș cere o secțiune mărită și precizarea fixării șorțului.”
                </blockquote>
                <p>
                  Un alt profesionist desenează peste detaliu și își explică propunerea. Fiecare
                  schiță are propriul autor; contribuțiile sunt asincrone.
                </p>
                <button
                  type="button"
                  className={styles.nextStep}
                  onClick={() => selectStep("arguments")}
                >
                  Vezi argumentele <ArrowRight size={18} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <p className={styles.eyebrow}>Cântărește argumentele</p>
                <h3>Știi cine aprobă. Și de ce cineva dezaprobă.</h3>
                <div className={styles.position}>
                  <span className={styles.positionLabel}>
                    <Check size={16} aria-hidden="true" /> Aprob schița
                  </span>
                  <ExampleAuthor name="Ana" role="PROIECTANT" label="Proiectant" />
                  <p>
                    „Marcajul face clar punctul de discutat. Fixarea trebuie explicată separat.”
                  </p>
                </div>
                <div className={styles.position}>
                  <span className={`${styles.positionLabel} ${styles.disapproval}`}>
                    <X size={16} aria-hidden="true" /> Dezaprob schița
                  </span>
                  <ExampleAuthor name="Radu" role="FURNIZOR" label="Furnizor" />
                  <p>
                    „Nu este încă precizat sistemul de fixare. Aș cere acest context înainte de
                    montaj.”
                  </p>
                </div>
                <p className={styles.argumentRule}>
                  Dezaprobarea cere justificare. Pozițiile sunt contribuții la discuție, nu o
                  certificare tehnică.
                </p>
              </>
            )}
          </div>
        </div>
      ))}
      <p className={styles.demoDisclaimer}>
        Exemplu ilustrativ, cu persoane și texte fictive. Nu reprezintă o recomandare de proiectare.
      </p>
    </DemoFrame>
  );
}

const workspaceTabs = [
  {
    id: "project",
    label: "Proiecte",
    hint: "Cu echipa invitată",
    icon: <Users size={22} aria-hidden="true" />,
  },
  {
    id: "board",
    label: "Planșe",
    hint: "Pe suprafața ta de lucru",
    icon: <Layers size={22} aria-hidden="true" />,
  },
] as const;
type Workspace = (typeof workspaceTabs)[number]["id"];
export function WorkspaceDemo() {
  const prefix = useId();
  const [space, setSpace] = useState<Workspace>("project");
  return (
    <DemoFrame label="Demonstrație Proiecte și Planșe" className={styles.workspaceDemo}>
      <DemoTabs
        tabs={workspaceTabs}
        active={space}
        onChange={setSpace}
        prefix={prefix}
        label="Alege spațiul de lucru"
      />
      {workspaceTabs.map(({ id }) => (
        <div
          key={id}
          id={`${prefix}-panel-${id}`}
          role="tabpanel"
          tabIndex={0}
          aria-labelledby={`${prefix}-tab-${id}`}
          hidden={space !== id}
          className={styles.workspacePanel}
        >
          <div className={styles.workspaceExplanation}>
            <p className={styles.eyebrow}>
              {id === "project" ? "Conversația echipei" : "Spațiul tău de compoziție"}
            </p>
            <h3>
              {id === "project"
                ? "Aceiași oameni. Tot contextul într-un loc."
                : "Pune detaliile alături. Gândește cu desenul în față."}
            </h3>
            <p>
              {id === "project"
                ? "Invită oamenii implicați și discută detaliile în proiect. Nu trebuie să deschizi conversația către toată comunitatea."
                : "Adună detalii pe o suprafață de lucru, aranjează-le, desenează și exportă. Planșa rămâne privată."}
            </p>
            <ul>
              {(id === "project"
                ? [
                    "Acces pe bază de invitație",
                    "Detalii și discuții pentru echipă",
                    "Publicare în comunitate doar explicit",
                  ]
                : [
                    "Compoziție cu mai multe detalii",
                    "Desen și export din același spațiu",
                    "Partajezi o copie în proiect doar dacă alegi",
                  ]
              ).map((text) => (
                <li key={text}>
                  <Check size={16} aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            <span className={styles.workspacePrivate}>
              <LockKeyhole size={16} aria-hidden="true" />
              {id === "project"
                ? "Proiect privat · echipă invitată"
                : "Planșă privată · doar pentru tine"}
            </span>
          </div>
          {id === "project" ? (
            <div className={styles.projectPreview}>
              <div className={styles.previewHeading}>
                <span>PROIECT ILUSTRATIV</span>
                <span>
                  <LockKeyhole size={14} aria-hidden="true" /> Privat
                </span>
              </div>
              <h4>Casă cu terasă</h4>
              <p className={styles.previewSubtitle}>
                Echipa vede aceleași detalii și discuțiile lor.
              </p>
              <div className={styles.teamRow}>
                <span>
                  <Users size={18} aria-hidden="true" /> Echipă invitată
                </span>
                <RolePill roleMain="PROIECTANT" subRole="Proiectant" verified={false} />
                <RolePill roleMain="EXECUTANT" subRole="Executant" verified={false} />
              </div>
              <div className={styles.projectDetail}>
                <Image
                  src="/landing/terrace-detail.webp"
                  alt="Detaliu de terasă din proiectul ilustrativ."
                  width={1200}
                  height={800}
                  sizes="(max-width: 900px) 200px, 320px"
                />
                <div>
                  <span className={styles.eyebrow}>Detaliu în proiect</span>
                  <h5>Racord terasă–atic</h5>
                  <p>Întrebarea și schița rămân în contextul echipei.</p>
                  <span className={styles.previewStatus}>
                    <MessageSquare size={14} aria-hidden="true" /> Discuție legată de detaliu
                  </span>
                </div>
              </div>
              <div className={styles.projectFooter}>
                <LockKeyhole size={16} aria-hidden="true" />
                <p>
                  <strong>Nu este publicat în comunitate.</strong>
                  <br />
                  Autorul decide dacă îl publică explicit acolo.
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.boardPreview}>
              <div className={styles.previewHeading}>
                <span>PLANȘĂ ILUSTRATIVĂ</span>
                <span>
                  <LockKeyhole size={14} aria-hidden="true" /> Privată
                </span>
              </div>
              <div className={styles.boardToolbar} aria-label="Capabilități ale planșei">
                <span>
                  <Layers size={16} aria-hidden="true" /> Compoziție
                </span>
                <span>
                  <Pencil size={16} aria-hidden="true" /> Desen
                </span>
                <span>
                  <Download size={16} aria-hidden="true" /> Export
                </span>
              </div>
              <div className={styles.boardCanvas}>
                <figure>
                  <Image
                    src="/landing/terrace-detail.webp"
                    alt="Detaliul inițial, așezat pe planșă."
                    width={1200}
                    height={800}
                    sizes="(max-width: 900px) 45vw, 360px"
                  />
                  <figcaption>01 / Detaliul inițial</figcaption>
                </figure>
                <figure>
                  <Image
                    src="/landing/terrace-sketch.webp"
                    alt="Schița ilustrativă, alăturată detaliului pe planșă."
                    width={1200}
                    height={800}
                    sizes="(max-width: 900px) 45vw, 360px"
                  />
                  <figcaption>02 / Schița alăturată</figcaption>
                </figure>
                <p>
                  <Plus size={16} aria-hidden="true" /> Ideile rămân împreună, pe suprafața ta de
                  lucru.
                </p>
              </div>
              <div className={styles.projectFooter}>
                <LockKeyhole size={16} aria-hidden="true" />
                <p>
                  <strong>Planșa de lucru rămâne a ta.</strong>
                  <br />
                  Poți partaja o copie într-un proiect.
                </p>
              </div>
            </div>
          )}
        </div>
      ))}
      <p className={styles.demoDisclaimer}>
        Previzualizări ilustrative. Aici explorezi spațiile de lucru, fără să creezi sau să publici
        conținut.
      </p>
    </DemoFrame>
  );
}

const perspectives = [
  {
    id: "PROIECTANT",
    label: "Proiectant",
    hint: "Coerența proiectului",
    icon: <Compass size={24} aria-hidden="true" />,
    topic: "Racordul în ansamblul proiectului",
    question: "Cum continuă soluția din detaliu în restul proiectului?",
    body: "Urmărește relația dintre elemente, cotele și informațiile care lipsesc. O schiță poate face vizibil locul în care proiectul trebuie completat.",
    example: "Aș completa secțiunea cu racordul și relația cu straturile terasei.",
    focus: "Relații între elemente · cote · context",
  },
  {
    id: "EXECUTANT",
    label: "Executant",
    hint: "Punerea în operă",
    icon: <Hammer size={24} aria-hidden="true" />,
    topic: "Racordul văzut din șantier",
    question: "În ce ordine se montează și ce trebuie clarificat înainte?",
    body: "Aduce condițiile din șantier în discuție: acces, succesiunea lucrărilor și zonele greu de executat doar dintr-o secțiune generală.",
    example: "Aș cere un detaliu mărit al fixării, înainte să înceapă montajul.",
    focus: "Succesiune de montaj · acces · execuție",
  },
  {
    id: "FURNIZOR",
    label: "Furnizor",
    hint: "Materialul și montajul",
    icon: <Package size={24} aria-hidden="true" />,
    topic: "Racordul și sistemul de materiale",
    question: "Ce sistem de fixare și ce condiții de montaj presupune desenul?",
    body: "Poate clarifica cerințele materialului și informațiile necesare pentru alegerea unui sistem. Contextul proiectului rămâne esențial.",
    example: "Ce sistem este prevăzut și ce documentație de montaj îl însoțește?",
    focus: "Compatibilitate · sistem · documentație",
  },
  {
    id: "BENEFICIAR",
    label: "Beneficiar",
    hint: "Utilizarea construcției",
    icon: <House size={24} aria-hidden="true" />,
    topic: "Racordul și construcția folosită",
    question: "Ce implică alegerea pentru întreținere și utilizare?",
    body: "Aduce întrebările celui care va folosi construcția: ce trebuie înțeles acum, ce rămâne accesibil și ce presupune întreținerea.",
    example: "Ce trebuie să știu despre acest racord când folosesc și întrețin construcția?",
    focus: "Utilizare · acces ulterior · întreținere",
  },
] as const;
type Perspective = (typeof perspectives)[number]["id"];
export function RoleDemo() {
  const prefix = useId();
  const [role, setRole] = useState<Perspective>("PROIECTANT");
  return (
    <DemoFrame label="Perspective pe roluri" className={styles.roleDemo}>
      <DemoTabs
        tabs={perspectives}
        active={role}
        onChange={setRole}
        prefix={prefix}
        label="Perspective profesionale"
        className={styles.roleTabs}
      />
      <div className={styles.rolePanels}>
        {perspectives.map((perspective) => (
          <div
            key={perspective.id}
            role="tabpanel"
            id={`${prefix}-panel-${perspective.id}`}
            aria-labelledby={`${prefix}-tab-${perspective.id}`}
            tabIndex={0}
            hidden={role !== perspective.id}
            className={styles.rolePanel}
          >
            <div className={styles.roleContext}>
              <span>ACELAȘI CAZ / RACORD TERASĂ–ATIC</span>
              <RolePill roleMain={perspective.id} subRole={perspective.label} verified={false} />
            </div>
            <p className={styles.eyebrow}>{perspective.topic}</p>
            <h3>{perspective.question}</h3>
            <p>{perspective.body}</p>
            <blockquote>
              <span>O întrebare posibilă</span>„{perspective.example}”
            </blockquote>
            <p className={styles.roleFocus}>{perspective.focus}</p>
          </div>
        ))}
      </div>
    </DemoFrame>
  );
}
