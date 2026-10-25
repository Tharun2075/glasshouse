"use client";
// AG Grid Community only. Community has no row grouping/tree data, so the appeal → spend → receipt
// hierarchy is built by hand: full-width appeal rows toggle their spends via an external filter.
import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type IRowNode } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  backgroundColor: "var(--surface)", foregroundColor: "var(--ink)", accentColor: "var(--accent)", borderColor: "var(--line)",
  headerBackgroundColor: "var(--tint)", oddRowBackgroundColor: "var(--grid-row-alt)", rowHoverColor: "var(--grid-hover)",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontSize: 14,
});

type SpendRow = { id: number; appeal_id: number; vendor: string; date: string; amount_cents: number; category: string; status: string; hold_reason: string | null;
  flags: string[]; confidence: number; funded_by: number; payout: { batch_id: string | null; status: string } | null };
type Data = { appeals: { id: number; title: string; raised_cents: number; spent_cents: number }[]; spends: SpendRow[] };
type Row = { kind: "group"; appeal_id: number; title: string; count: number; total: number; held: number }
  | { kind: "spend"; appeal_id: number; id: number; vendor: string; date: string; amount: number; category: string; status: string; reason: string; funded_by: number; payout: string; receipt: string };

const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

function GroupRow(p: { data: Extract<Row, { kind: "group" }>; context: { open: Set<number>; toggle(id: number): void } }) {
  const open = p.context.open.has(p.data.appeal_id);
  // role="gridcell": a full-width row is role="row", which may only hold cells (axe aria-required-children).
  return (<div role="gridcell" style={{ display: "flex", gap: 12, alignItems: "center", padding: "0 12px", height: "100%" }}>
    <button className="ghost" style={{ padding: "0 8px" }} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${p.data.title}`} onClick={() => p.context.toggle(p.data.appeal_id)}>{open ? "▾" : "▸"}</button>
    <strong>{p.data.title}</strong><span>{p.data.count} spends · {money(p.data.total)}</span>
    {p.data.held > 0 && <span className="pill held">{p.data.held} held</span>}
  </div>);
}

// Phones: keep Vendor, Amount, Status and the hold reason; hide the rest so the reason is on screen at 390px.
const NARROW_HIDE = ["id", "date", "category", "payout", "receipt"];
function fit(a: GridApi<Row>) { a.setColumnsVisible(NARROW_HIDE, typeof window === "undefined" || window.innerWidth > 640); }

export default function LedgerGrid({ data }: { data: Data }) {
  const api = useRef<GridApi<Row> | null>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set(data.appeals.map((a) => a.id)));
  const [q, setQ] = useState(""), [nl, setNl] = useState(""), [nlMsg, setNlMsg] = useState("");
  const openRef = useRef(open); openRef.current = open;
  const toggle = useCallback((id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); openRef.current = n; setTimeout(() => api.current?.onFilterChanged()); return n; }), []);

  const rows = useMemo<Row[]>(() => data.appeals.flatMap((a) => {
    const sp = data.spends.filter((s) => s.appeal_id === a.id);
    return [{ kind: "group", appeal_id: a.id, title: a.title, count: sp.length, total: sp.reduce((t, s) => t + s.amount_cents, 0) / 100, held: sp.filter((s) => s.status === "held").length } as Row,
      ...sp.map((s) => ({ kind: "spend", appeal_id: a.id, id: s.id, vendor: s.vendor, date: s.date, amount: s.amount_cents / 100, category: s.category, status: s.status,
        reason: s.hold_reason ?? (s.flags.length ? s.flags.join(", ") : ""), funded_by: s.funded_by, payout: s.payout ? `${s.payout.status}${s.payout.batch_id ? ` · ${s.payout.batch_id}` : ""}` : "", receipt: `/api/receipts/${s.id}` }) as Row)];
  }), [data]);

  const cols = useMemo<ColDef<Row>[]>(() => [
    { field: "id" as any, headerName: "#", width: 70, filter: "agNumberColumnFilter" },
    { field: "date" as any, headerName: "Date", width: 120, filter: "agDateColumnFilter", sort: undefined },
    { field: "vendor" as any, headerName: "Vendor", flex: 1, minWidth: 160, filter: "agTextColumnFilter" },
    { field: "category" as any, headerName: "Category", width: 140, filter: "agTextColumnFilter" },
    { field: "amount" as any, headerName: "Amount", width: 130, filter: "agNumberColumnFilter", type: "rightAligned", valueFormatter: (p) => (p.value == null ? "" : money(p.value)),
      cellClassRules: { "mono": () => true } },
    { field: "status" as any, headerName: "Status", width: 120, filter: "agTextColumnFilter", cellRenderer: (p: any) => p.value ? <span className={`pill ${p.value}`}>{p.value}</span> : null },
    { field: "reason" as any, headerName: "Why held / flags", flex: 1, minWidth: 220, tooltipField: "reason" as any },
    { field: "payout" as any, headerName: "Payout batch", width: 200 },
    { field: "receipt" as any, headerName: "Receipt", width: 110, sortable: false, filter: false, cellRenderer: (p: any) => p.value ? <a href={p.value} target="_blank" rel="noreferrer">View receipt</a> : null },
  ], []);

  const spendsOnly = rows.filter((r): r is Extract<Row, { kind: "spend" }> => r.kind === "spend");
  const pinned = useMemo(() => [{ kind: "spend", vendor: "Approved total", amount: spendsOnly.filter((r) => r.status === "approved" || r.status === "paid").reduce((t, r) => t + r.amount, 0) } as any], [rows]);

  async function runNl(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/nl-filter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: nl }) });
    const b = await r.json();
    if (!r.ok) { setNlMsg(b.error); return; }
    api.current?.setFilterModel(b.model);
    setNlMsg(`Applied filter (${b.by}): ${JSON.stringify(b.model)}`);
  }

  return (<div>
    <div className="grid-tools">
      <div style={{ flex: 1, minWidth: 220 }}><label htmlFor="q">Search all columns</label><input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="vendor, category, status…" style={{ width: "100%" }} /></div>
      <form onSubmit={runNl} style={{ flex: 2, minWidth: 260, display: "flex", gap: 8, alignItems: "end" }}>
        <div style={{ flex: 1 }}><label htmlFor="nl">Ask in plain words</label><input id="nl" value={nl} onChange={(e) => setNl(e.target.value)} placeholder="spends over $100" style={{ width: "100%" }} /></div>
        <button type="submit">Filter</button>
      </form>
      <button className="ghost" type="button" onClick={() => { api.current?.setFilterModel(null); setQ(""); setNlMsg(""); }}>Clear</button>
      <button className="ghost" type="button" onClick={() => api.current?.exportDataAsCsv({ fileName: "glasshouse-ledger.csv", shouldRowBeSkipped: (p) => p.node.data?.kind === "group" })}>Export CSV</button>
    </div>
    {nlMsg && <p className="muted mono" role="status">{nlMsg}</p>}
    <div className="gridwrap">
      <AgGridReact<Row>
        theme={theme} rowData={rows} columnDefs={cols} context={{ open, toggle }}
        defaultColDef={{ sortable: true, resizable: true, filter: true }}
        quickFilterText={q} pagination paginationPageSize={20} paginationPageSizeSelector={[10, 20, 50]}
        pinnedBottomRowData={pinned} tooltipShowDelay={200} enableCellTextSelection
        isFullWidthRow={(p) => p.rowNode.data?.kind === "group"} fullWidthCellRenderer={GroupRow}
        isExternalFilterPresent={() => true}
        doesExternalFilterPass={(n: IRowNode<Row>) => n.data?.kind === "group" || openRef.current.has(n.data!.appeal_id)}
        rowClassRules={{ "row-held": (p) => p.data?.kind === "spend" && p.data.status === "held", "row-group": (p) => p.data?.kind === "group", "row-paid": (p) => p.data?.kind === "spend" && p.data.status === "paid" }}
        getRowId={(p) => p.data.kind === "group" ? `g${p.data.appeal_id}` : `s${p.data.id}`}
        onGridReady={(e) => { api.current = e.api; fit(e.api); }}
        onGridSizeChanged={(e) => fit(e.api)}
      />
    </div>
  </div>);
}
