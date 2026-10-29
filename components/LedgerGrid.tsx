"use client";
// AG Grid Community only. Community has no row grouping/tree data, so the appeal → spend → receipt
// hierarchy is built by hand: full-width appeal rows toggle their spends via an external filter.
import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ChevronDown, ChevronRight, Download, Eraser, FileText, Hourglass, Search, Sparkles } from "lucide-react";
import StatusChip from "./StatusChip.tsx";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type IRowNode } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  backgroundColor: "var(--surface)", foregroundColor: "var(--ink)", accentColor: "var(--accent)", borderColor: "var(--line)",
  headerBackgroundColor: "var(--tint)", oddRowBackgroundColor: "var(--grid-row-alt)", rowHoverColor: "var(--grid-hover)",
  fontFamily: "var(--font-sans)", fontSize: 14, headerFontWeight: 650, rowHeight: 48, headerHeight: 44, wrapperBorderRadius: 14,
});

type SpendRow = { id: number; appeal_id: number; vendor: string; date: string; amount_cents: number; category: string; status: string; hold_reason: string | null;
  flags: string[]; confidence: number; funded_by: number; payout: { batch_id: string | null; status: string } | null };
type Data = { appeals: { id: number; title: string; raised_cents: number; spent_cents: number }[]; spends: SpendRow[] };
type Row = { kind: "group"; appeal_id: number; title: string; count: number; total: number; held: number }
  | { kind: "spend"; appeal_id: number; appeal: string; id: number; vendor: string; date: string; amount: number; category: string; status: string; reason: string; funded_by: number; payout: string; receipt: string };

const money = (n: number) => (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

function GroupRow(p: { data: Extract<Row, { kind: "group" }>; context: { open: Set<number>; toggle(id: number): void } }) {
  const open = p.context.open.has(p.data.appeal_id);
  // role="gridcell": a full-width row is role="row", which may only hold cells (axe aria-required-children).
  return (<div role="gridcell" className="group-row">
    <button type="button" className="ghost grid-toggle" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${p.data.title}`} onClick={() => p.context.toggle(p.data.appeal_id)}>{open ? <ChevronDown className="icon" aria-hidden size={18} /> : <ChevronRight className="icon" aria-hidden size={18} />}</button>
    <strong>{p.data.title}</strong><span className="muted">{p.data.count} spends · {money(p.data.total)}</span>
    {p.data.held > 0 && <span className="pill held">{p.data.held} held</span>}
  </div>);
}

// Phones: keep Vendor, Amount, Status and the hold reason; hide the rest so the reason is on screen at 390px.
const NARROW_HIDE = ["id", "date", "category", "reason", "payout", "receipt"];
// Phones keep Vendor, Amount, Status only, narrowed so all three fit a 390px screen without sideways scroll.
function fit(a: GridApi<Row>) {
  const wide = typeof window === "undefined" || window.innerWidth > 640;
  a.setColumnsVisible(NARROW_HIDE, wide);
  a.setColumnWidths([{ key: "amount", newWidth: wide ? 130 : 92 }, { key: "status", newWidth: wide ? 120 : 108 }]);
}

export default function LedgerGrid({ data }: { data: Data }) {
  const api = useRef<GridApi<Row> | null>(null);
  const [open, setOpen] = useState<Set<number>>(() => new Set(data.appeals.map((a) => a.id)));
  const [q, setQ] = useState(""), [nl, setNl] = useState(""), [nlMsg, setNlMsg] = useState("");
  const [ids, setIds] = useState<Set<number> | null>(null);
  const openRef = useRef(open); openRef.current = open;
  const toggle = useCallback((id: number) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); openRef.current = n; setTimeout(() => api.current?.onFilterChanged()); return n; }), []);

  const rows = useMemo<Row[]>(() => data.appeals.flatMap((a) => {
    const sp = data.spends.filter((s) => s.appeal_id === a.id);
    return [{ kind: "group", appeal_id: a.id, title: a.title, count: sp.length, total: sp.reduce((t, s) => t + s.amount_cents, 0) / 100, held: sp.filter((s) => s.status === "held").length } as Row,
      ...sp.map((s) => ({ kind: "spend", appeal_id: a.id, appeal: a.title, id: s.id, vendor: s.vendor, date: s.date, amount: s.amount_cents / 100, category: s.category, status: s.status,
        reason: s.hold_reason ?? (s.flags.length ? s.flags.join(", ") : ""), funded_by: s.funded_by, payout: s.payout ? `${s.payout.status}${s.payout.batch_id ? ` · ${s.payout.batch_id}` : ""}` : "", receipt: `/api/receipts/${s.id}` }) as Row)];
  }), [data]);

  const cols = useMemo<ColDef<Row>[]>(() => [
    { field: "id" as any, headerName: "#", width: 70, filter: "agNumberColumnFilter" },
    // Dates are "YYYY-MM-DD" strings; inclusive range so "since 1 Oct" keeps 1 Oct itself.
    { field: "date" as any, headerName: "Date", width: 132, minWidth: 132, cellDataType: "dateString", filter: "agDateColumnFilter", filterParams: { inRangeInclusive: true }, sort: undefined },
    // Hidden: lets the plain-words filter match an appeal name ("kitchen equipment") without touching category.
    { field: "appeal" as any, headerName: "Appeal", hide: true, filter: "agTextColumnFilter" },
    // Phones hide the "Why held" column, so a held row repeats its reason under the vendor (CSS shows .why only below 640px).
    { field: "vendor" as any, headerName: "Vendor", flex: 1, minWidth: 110, filter: "agTextColumnFilter", autoHeight: true,
      cellRenderer: (p: any) => (<div className="vendor-cell">{p.value}{p.data?.status === "held" && p.data.reason && <span className="why">{p.data.reason}</span>}</div>) },
    { field: "category" as any, headerName: "Category", width: 100, filter: "agTextColumnFilter" },
    { field: "amount" as any, headerName: "Amount", width: 130, filter: "agNumberColumnFilter", type: "rightAligned", cellClass: ["ag-right-aligned-cell", "c-tight"], valueFormatter: (p) => (p.value == null ? "" : money(p.value)),
      cellClassRules: { "mono": () => true } },
    { field: "status" as any, headerName: "Status", width: 120, cellClass: "c-tight", filter: "agTextColumnFilter", filterParams: { maxNumConditions: 5 }, cellRenderer: (p: any) => p.value ? <StatusChip status={p.value} /> : null },
    { field: "reason" as any, headerName: "Why held / flags", flex: 1.4, minWidth: 200, wrapText: true, autoHeight: true, cellClass: "wrap-cell" },
    { field: "payout" as any, headerName: "Payout batch", flex: 1, minWidth: 110, tooltipField: "payout" as any },
    { field: "receipt" as any, headerName: "Receipt", flex: 1, minWidth: 150, sortable: false, filter: false, cellRenderer: (p: any) => !p.value ? null
      : p.data.status === "approved" || p.data.status === "paid" ? <a className="receipt-link" data-track="view-receipt" href={p.value} target="_blank" rel="noreferrer"><FileText className="icon" aria-hidden size={16} />View receipt</a> : <span className="reader"><Hourglass className="icon" aria-hidden size={14} />After review</span> },
  ], []);

  const spendsOnly = rows.filter((r): r is Extract<Row, { kind: "spend" }> => r.kind === "spend");
  const pinned = useMemo(() => [{ kind: "spend", vendor: "Approved", amount: spendsOnly.filter((r) => r.status === "approved" || r.status === "paid").reduce((t, r) => t + r.amount, 0) } as any], [rows]);

  // The phone cards read the grid's own filter result, so search, plain-words filter and collapse apply to both views.
  const syncIds = useCallback((a: GridApi<Row>) => {
    const n = new Set<number>();
    a.forEachNodeAfterFilter((x) => { if (x.data?.kind === "spend") n.add(x.data.id); });
    setIds(n);
  }, []);

  // Plain words for the applied filter, never raw JSON.
  function describe(m: Record<string, any> | null) {
    const parts = Object.entries(m ?? {}).map(([k, f]: [string, any]) => {
      const conds = f.conditions ?? [f];
      const v = conds.map((c: any) => c.type === "inRange" ? `${c.dateFrom ?? c.filter} to ${c.dateTo ?? c.filterTo}` : `${c.type === "greaterThan" || c.type === "greaterThanOrEqual" ? "from " : c.type === "lessThan" || c.type === "lessThanOrEqual" ? "up to " : c.type === "notEqual" ? "not " : ""}${String(c.dateFrom ?? c.filter ?? "").replace(/ 00:00:00$/, "")}`).join(" or ");
      return `${k} ${v}`;
    });
    return parts.length ? `Showing spends where ${parts.join(", ")}.` : "No filter matched those words, so all spends are shown. Try a vendor, category, status or date.";
  }

  async function runNl(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/nl-filter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: nl }) });
    const b = await r.json();
    if (!r.ok) { setNlMsg(b.error); return; }
    api.current?.setFilterModel(b.model);
    setNlMsg(`${b.limit_note ? `${b.limit_note}. ` : ""}${describe(b.model)}`);
  }

  return (<div>
    <div className="grid-tools">
      <div className="field"><label htmlFor="q"><Search className="icon" aria-hidden size={14} /> Search all columns</label><input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="vendor, category, status…" /></div>
      <form onSubmit={runNl} className="nl">
        <div className="field"><label htmlFor="nl"><Sparkles className="icon" aria-hidden size={14} /> Ask in plain words</label><input id="nl" value={nl} onChange={(e) => setNl(e.target.value)} placeholder="unpaid kitchen spends since 1 Oct" /></div>
        <button type="submit">Filter</button>
      </form>
      <button className="ghost" type="button" onClick={() => { api.current?.setFilterModel(null); setQ(""); setNlMsg(""); }}><Eraser className="icon" aria-hidden size={16} />Clear</button>
      <button className="ghost" type="button" onClick={() => api.current?.exportDataAsCsv({ fileName: "glasshouse-ledger.csv", shouldRowBeSkipped: (p) => p.node.data?.kind === "group" })}><Download className="icon" aria-hidden size={16} />Export CSV</button>
    </div>
    {nlMsg && <p className="note nl-msg" role="status">{nlMsg}</p>}
    <div className="gridwrap">
      <AgGridReact<Row>
        theme={theme} rowData={rows} columnDefs={cols} context={{ open, toggle }}
        defaultColDef={{ sortable: true, resizable: true, filter: true }}
        quickFilterText={q} domLayout="autoHeight" pagination paginationPageSize={typeof window !== "undefined" && window.innerWidth < 640 ? 10 : 20} paginationPageSizeSelector={[10, 20, 50]}
        pinnedBottomRowData={pinned} tooltipShowDelay={200} enableCellTextSelection
        isFullWidthRow={(p) => p.rowNode.data?.kind === "group"} fullWidthCellRenderer={GroupRow}
        isExternalFilterPresent={() => true}
        doesExternalFilterPass={(n: IRowNode<Row>) => n.data?.kind === "group" || openRef.current.has(n.data!.appeal_id)}
        rowClassRules={{ "row-held": (p) => p.data?.kind === "spend" && p.data.status === "held", "row-group": (p) => p.data?.kind === "group", "row-paid": (p) => p.data?.kind === "spend" && p.data.status === "paid" }}
        getRowId={(p) => p.data.kind === "group" ? `g${p.data.appeal_id}` : `s${p.data.id}`}
        onGridReady={(e) => { api.current = e.api; fit(e.api); syncIds(e.api); }}
        onFilterChanged={(e) => syncIds(e.api)}
        onGridSizeChanged={(e) => fit(e.api)}
      />
    </div>
    <div className="ledger-cards" aria-label="Spends by appeal">
      {rows.filter((r): r is Extract<Row, { kind: "group" }> => r.kind === "group").map((g) => {
        const isOpen = open.has(g.appeal_id);
        const list = spendsOnly.filter((r) => r.appeal_id === g.appeal_id && (ids === null || ids.has(r.id)));
        return (<section className="lc-group" key={g.appeal_id}>
          <div className="lc-head">
            <button type="button" className="ghost grid-toggle" aria-expanded={isOpen} aria-label={`${isOpen ? "Collapse" : "Expand"} ${g.title}`} onClick={() => toggle(g.appeal_id)}>{isOpen ? <ChevronDown className="icon" aria-hidden size={18} /> : <ChevronRight className="icon" aria-hidden size={18} />}</button>
            <div className="lc-title"><strong>{g.title}</strong><span className="muted">{g.count} spends · {money(g.total)}</span></div>
            {g.held > 0 && <span className="pill held">{g.held} held</span>}
          </div>
          {isOpen && list.map((r) => (<article className={`lc-card${r.status === "held" ? " row-held" : ""}`} key={r.id}>
            <div className="lc-top"><strong className="lc-vendor">{r.vendor}</strong><span className="mono lc-amt">{money(r.amount)}</span></div>
            <div className="lc-meta"><StatusChip status={r.status} /><span className="muted">{r.date}</span></div>
            {r.reason && <p className="lc-reason">{r.reason}</p>}
            {r.status === "approved" || r.status === "paid" ? <a className="receipt-link" data-track="view-receipt" href={r.receipt} target="_blank" rel="noreferrer"><FileText className="icon" aria-hidden size={16} />View receipt</a> : <span className="reader"><Hourglass className="icon" aria-hidden size={14} />After review</span>}
          </article>))}
          {isOpen && list.length === 0 && <p className="muted lc-empty">No spends match.</p>}
        </section>);
      })}
    </div>
  </div>);
}
