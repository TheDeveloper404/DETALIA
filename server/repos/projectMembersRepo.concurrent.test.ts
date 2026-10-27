import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Opt-in local PostgreSQL only: never use DATABASE_URL or the shared Neon test database.
const localUrl = process.env.LOCAL_POSTGRES_URL;
const psqlPath = process.env.PSQL_PATH ?? "psql";
const state = vi.hoisted(() => ({ connection: null as Connection | null, holdBatchCommit: false }));

type Query = { text: string; params: unknown[] };
function literal(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "'" + String(value instanceof Date ? value.toISOString() : value).replaceAll("'", "''") + "'";
}
function render(query: Query): string {
  return query.text.replace(/\$(\d+)/g, (_, index: string) => literal(query.params[Number(index) - 1]));
}

// The actual Neon Drizzle driver compiles repository SQL and groups db.batch into a transaction.
// Only the transport is replaced by local psql; application queries are not copied into this test.
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const client = {
    query(text: string, params: unknown[]) {
      const connection = state.connection!;
      return {
        text, params,
        then(resolve: (value: { rows: { id: string }[] }) => unknown, reject: (error: unknown) => unknown) {
          return connection.run(render({ text, params }) + ";").then((rows) => ({ rows: rows.map((id) => ({ id })) })).then(resolve, reject);
        },
      };
    },
    async transaction(queries: Query[]) {
      const statements = queries.map((query) => render(query) + ";").join("\n");
      await state.connection!.run(state.holdBatchCommit ? statements : "begin;\n" + statements + "\ncommit;");
      return queries.map(() => ({ rows: [] }));
    },
  };
  return { db: drizzle({ client: client as never, casing: "snake_case" }) };
});

class Connection {
  private process: ChildProcessWithoutNullStreams;
  private buffer = "";
  private stderr = "";
  private pending?: { marker: string; rows: string[]; resolve: (rows: string[]) => void; reject: (error: Error) => void };
  constructor(url: string) {
    this.process = spawn(psqlPath, ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", url], { windowsHide: true });
    this.process.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      let index: number;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (line === this.pending?.marker) {
          const pending = this.pending;
          this.pending = undefined;
          pending.resolve(pending.rows);
        } else if (line && this.pending) this.pending.rows.push(line);
      }
    });
    this.process.stderr.on("data", (chunk: Buffer) => { this.stderr += chunk.toString(); });
    this.process.on("error", (error) => { this.pending?.reject(error); this.pending = undefined; });
    this.process.on("close", (code) => { this.pending?.reject(new Error(`psql exited (${code}): ${this.stderr}`)); this.pending = undefined; });
  }
  run(statement: string): Promise<string[]> {
    if (this.pending) throw new Error("Concurrent commands on one psql connection");
    const marker = "done_" + randomUUID();
    return new Promise((resolve, reject) => {
      this.pending = { marker, rows: [], resolve, reject };
      this.process.stdin.write(statement + "\n\\echo " + marker + "\n");
    });
  }
  close() { this.process.stdin.end("\\q\n"); }
}

describe.skipIf(!localUrl)("DET-01: independent PostgreSQL connections", () => {
  const schema = "race_" + randomUUID().replaceAll("-", "");
  const projectId = randomUUID(), userId = randomUUID();
  let first: Connection, second: Connection, observer: Connection;
  let firstPid: string, secondPid: string;
  let repo: typeof import("./projectMembersRepo");
  async function connect() {
    const url = new URL(localUrl!);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("LOCAL_POSTGRES_URL must use loopback");
    const connection = new Connection(localUrl!);
    // Neon/PostgreSQL default isolation: the second batch statement must obtain a fresh snapshot.
    await connection.run(`set search_path to ${schema}; set default_transaction_isolation = 'read committed'; set statement_timeout = '10s';`);
    return connection;
  }
  beforeAll(async () => {
    observer = await connect();
    await observer.run(`create schema ${schema}; set search_path to ${schema};
      create table projects (id uuid primary key, invite_token text not null, invite_token_created_at timestamptz default now());
      create table project_members (id uuid primary key default gen_random_uuid(), project_id uuid not null references projects(id), user_id uuid not null, removed_at timestamptz, joined_at timestamptz default now(), unique(project_id,user_id));`);
    first = await connect(); second = await connect();
    [firstPid] = await first.run("select pg_backend_pid();");
    [secondPid] = await second.run("select pg_backend_pid();");
    repo = await import("./projectMembersRepo");
  });
  beforeEach(async () => {
    await observer.run(`truncate project_members, projects; insert into projects(id,invite_token) values ('${projectId}','old');`);
  });
  afterAll(async () => {
    first?.close(); second?.close();
    if (observer) { await observer.run(`drop schema ${schema} cascade;`); observer.close(); }
  });
  async function blockedBy(blocked: string, blocker: string) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const [found] = await observer.run(`select ${blocker} = any(pg_blocking_pids(${blocked}));`);
      if (found === "t") return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Expected PostgreSQL row-lock contention was not reached");
  }
  async function active() {
    const [value] = await observer.run(`select count(*) from project_members where project_id='${projectId}' and user_id='${userId}' and removed_at is null;`);
    return Number(value);
  }

  // Regula (CONTEXT.md): "Eliminarea membrului invalideaza automat invitatia veche."
  it.each(["removed", "never-member"])("remove wins after an uncommitted join: %s", async (initial) => {
    if (initial === "removed") await observer.run(`insert into project_members(project_id,user_id,removed_at) values ('${projectId}','${userId}',now());`);
    await first.run("begin;");
    state.connection = first;
    expect(await repo.upsertActiveMembership(projectId, userId, "old")).toBe(true);
    state.connection = second;
    const removal = repo.removeMembership(projectId, userId, "new");
    try { await blockedBy(secondPid, firstPid); }
    finally { await first.run("commit;"); }
    await removal;
    expect(await active()).toBe(0);
    state.connection = second;
    expect(await repo.upsertActiveMembership(projectId, userId, "old")).toBe(false);
    expect(await repo.upsertActiveMembership(projectId, userId, "new")).toBe(true);
  });

  // Regula (CONTEXT.md): "Eliminarea membrului invalideaza automat invitatia veche."
  it("a join waiting behind removal rechecks the rotated token", async () => {
    await observer.run(`insert into project_members(project_id,user_id) values ('${projectId}','${userId}');`);
    await first.run("begin;");
    state.connection = first;
    // Hold the real repository's transaction open only to control the contention schedule.
    state.holdBatchCommit = true;
    try { await repo.removeMembership(projectId, userId, "new"); }
    finally { state.holdBatchCommit = false; }
    state.connection = second;
    const join = repo.upsertActiveMembership(projectId, userId, "old");
    try { await blockedBy(secondPid, firstPid); }
    finally { await first.run("commit;"); }
    expect(await join).toBe(false);
    expect(await active()).toBe(0);
  });

  // Regula aprobata: "Rotirea si eliminarea sunt un singur [commit]" — esecul eliminarii nu roteste invitatia.
  it("rolls back token rotation if membership update fails", async () => {
    await observer.run(`insert into project_members(project_id,user_id) values ('${projectId}','${userId}'); alter table project_members add constraint reject_removal check(removed_at is null);`);
    const failing = await connect();
    state.connection = failing;
    try { await expect(repo.removeMembership(projectId, userId, "new")).rejects.toThrow(); }
    finally { failing.close(); }
    const [token] = await observer.run(`select invite_token from projects where id='${projectId}';`);
    expect(token).toBe("old");
    expect(await active()).toBe(1);
    await observer.run("alter table project_members drop constraint reject_removal;");
  });
});
