import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import {
  listDatabaseTables,
  describeDatabaseTable,
  listDatabaseRows,
  insertDatabaseRow,
  updateDatabaseRow,
  deleteDatabaseRow,
  createDatabaseTable,
  dropDatabaseTable,
} from "../../api";
import { dbError } from "../../lib/dbErrors";
import { Cell } from "./ResultGrid";
import DbErrorBox from "./DbErrorBox";
import RowEditorModal from "./RowEditorModal";
import CreateTableModal from "./CreateTableModal";

const OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "contains", label: "contient" },
  { value: "null", label: "est NULL" },
  { value: "notnull", label: "n'est pas NULL" },
];
const OP_LABEL = Object.fromEntries(OPS.map((o) => [o.value, o.label]));
const PAGE_SIZES = [25, 50, 100, 200];

function formatEstimate(n) {
  if (n < 0) return "";
  if (n < 1000) return `≈ ${n}`;
  if (n < 1_000_000) return `≈ ${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} k`;
  return `≈ ${(n / 1_000_000).toFixed(1)} M`;
}

// TableBrowser liste les tables de la database et affiche, pour la table choisie,
// ses lignes (tri, filtres, pagination, ajout/modification/suppression) ou sa
// structure. run(fn) exécute fn(sessionId) sur la session courante (voir
// DatabaseManager, qui la rouvre si elle a expiré).
export default function TableBrowser({ namespace, component, run }) {
  const [catalog, setCatalog] = useState({ schemas: [], tables: [] });
  const [catalogError, setCatalogError] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // {schema, name}
  const [info, setInfo] = useState(null);
  const [view, setView] = useState("data");
  const [query, setQuery] = useState({ limit: 50, offset: 0, sort: "", desc: false, filters: [] });
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ column: "", op: "eq", value: "" });
  const [editor, setEditor] = useState(null); // {mode, index}
  const [createOpen, setCreateOpen] = useState(false);
  const [dropError, setDropError] = useState(null);

  async function loadCatalog() {
    try {
      const cat = await run((sid) => listDatabaseTables(namespace, component, sid));
      setCatalog(cat);
      setCatalogError(null);
      return cat;
    } catch (err) {
      setCatalogError(dbError(err));
      return null;
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  function selectTable(t) {
    setSelected({ schema: t.schema, name: t.name });
    setQuery({ limit: query.limit, offset: 0, sort: "", desc: false, filters: [] });
    setView("data");
    setInfo(null);
    setPage(null);
    setError(null);
    setDropError(null);
    setDraft({ column: "", op: "eq", value: "" });
  }

  useEffect(() => {
    if (!selected) return;
    run((sid) => describeDatabaseTable(namespace, component, sid, selected.schema, selected.name))
      .then(setInfo)
      .catch((err) => setError(dbError(err)));
  }, [selected]);

  async function loadRows() {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await run((sid) => listDatabaseRows(namespace, component, sid, selected.schema, selected.name, query));
      setPage(res);
      setError(null);
    } catch (err) {
      setError(dbError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [selected, query]);

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const groups = new Map(catalog.schemas.map((s) => [s, []]));
    for (const t of catalog.tables) {
      if (needle && !t.name.toLowerCase().includes(needle)) continue;
      if (!groups.has(t.schema)) groups.set(t.schema, []);
      groups.get(t.schema).push(t);
    }
    return [...groups.entries()].filter(([, tables]) => tables.length > 0 || !needle);
  }, [catalog, search]);

  function toggleSort(column) {
    setQuery((q) => {
      if (q.sort !== column) return { ...q, sort: column, desc: false, offset: 0 };
      if (!q.desc) return { ...q, desc: true, offset: 0 };
      return { ...q, sort: "", desc: false, offset: 0 };
    });
  }

  function addFilter(e) {
    e.preventDefault();
    const column = draft.column || info?.columns[0]?.name;
    if (!column) return;
    const needsValue = draft.op !== "null" && draft.op !== "notnull";
    const filter = { column, op: draft.op, ...(needsValue ? { value: draft.value } : {}) };
    setQuery((q) => ({ ...q, offset: 0, filters: [...q.filters, filter] }));
    setDraft((d) => ({ ...d, value: "" }));
  }

  function removeFilter(i) {
    setQuery((q) => ({ ...q, offset: 0, filters: q.filters.filter((_, idx) => idx !== i) }));
  }

  // rowKey désigne une ligne : colonnes de la clé primaire, ou ctid sans clé.
  function rowKey(index) {
    if (page.rowIds) return { $ctid: page.rowIds[index] };
    return Object.fromEntries(page.keyColumns.map((k) => [k, page.rows[index][page.columns.indexOf(k)]]));
  }

  async function submitRow(values) {
    if (editor.mode === "insert") {
      await run((sid) => insertDatabaseRow(namespace, component, sid, selected.schema, selected.name, values));
    } else {
      await run((sid) => updateDatabaseRow(namespace, component, sid, selected.schema, selected.name, rowKey(editor.index), values));
    }
    setEditor(null);
    loadRows();
  }

  async function deleteRow(index) {
    await run((sid) => deleteDatabaseRow(namespace, component, sid, selected.schema, selected.name, rowKey(index)));
    setEditor(null);
    loadRows();
  }

  async function quickDelete(index) {
    try {
      await deleteRow(index);
    } catch (err) {
      setError(dbError(err));
    }
  }

  async function createTable(schema, name, columns) {
    await run((sid) => createDatabaseTable(namespace, component, sid, schema, name, columns));
    setCreateOpen(false);
    await loadCatalog();
    selectTable({ schema, name });
  }

  async function dropTable(cascade) {
    setDropError(null);
    try {
      await run((sid) => dropDatabaseTable(namespace, component, sid, selected.schema, selected.name, cascade));
      setSelected(null);
      setInfo(null);
      setPage(null);
      loadCatalog();
    } catch (err) {
      setDropError(dbError(err));
    }
  }

  const editable = page?.editable;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] gap-4">
      {/* Liste des tables */}
      <div className="md:border-r md:border-slate-100 md:pr-4 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher"
              className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1.5 text-xs"
            />
          </div>
          <button onClick={loadCatalog} title="Recharger la liste" className="text-slate-400 hover:text-slate-600 p-1">
            <RefreshCw size={13} />
          </button>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 border border-dashed border-slate-300 rounded-md py-1.5 mb-3 hover:border-slate-400 hover:text-slate-800 transition"
        >
          <Plus size={12} />
          Nouvelle table
        </button>
        <DbErrorBox error={catalogError} />
        <div className="max-h-56 md:max-h-[34rem] overflow-y-auto space-y-3">
          {grouped.map(([schema, tables]) => (
            <div key={schema}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1 px-1 truncate">{schema}</p>
              {tables.length === 0 && <p className="text-[11px] text-slate-300 px-1">Aucune table</p>}
              {tables.map((t) => {
                const active = selected?.schema === t.schema && selected?.name === t.name;
                const Icon = t.kind.includes("view") ? Eye : Table2;
                return (
                  <button
                    key={t.name}
                    onClick={() => selectTable(t)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition ${
                      active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={12} className={`shrink-0 ${active ? "text-slate-300" : "text-slate-400"}`} />
                    <span className="font-mono truncate flex-1">{t.name}</span>
                    <span className={`text-[10px] shrink-0 ${active ? "text-slate-400" : "text-slate-300"}`}>
                      {formatEstimate(t.estimatedRows)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {catalog.tables.length === 0 && !catalogError && (
            <p className="text-xs text-slate-400 px-1">Aucune table pour l'instant.</p>
          )}
        </div>
      </div>

      {/* Table choisie */}
      <div className="min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400">
            <Table2 size={22} className="mb-2" />
            <p className="text-sm">Choisis une table pour voir ses données.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold font-mono truncate">
                  <span className="text-slate-400 font-normal">{selected.schema}.</span>
                  {selected.name}
                </h3>
                {info && <p className="text-[11px] text-slate-400">{info.kind}{!info.editable && " · lecture seule"}</p>}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  {[
                    ["data", "Données"],
                    ["structure", "Structure"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`text-xs font-medium px-3 py-1 rounded-md transition ${
                        view === v ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => dropTable(false)}
                  title="Supprimer la table"
                  className="text-slate-400 hover:text-red-600 transition p-1.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <DbErrorBox error={dropError}>
              {dropError?.sqlState === "2BP01" && (
                <button onClick={() => dropTable(true)} className="mt-1 text-xs font-medium text-red-700 underline">
                  Supprimer aussi ce qui en dépend (CASCADE)
                </button>
              )}
            </DbErrorBox>

            {view === "structure" ? (
              <Structure info={info} />
            ) : (
              <>
                {/* Filtres */}
                <form onSubmit={addFilter} className="flex flex-wrap items-center gap-2">
                  <Filter size={12} className="text-slate-400" />
                  <select
                    value={draft.column || info?.columns[0]?.name || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, column: e.target.value }))}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-mono bg-white max-w-[10rem]"
                  >
                    {info?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draft.op}
                    onChange={(e) => setDraft((d) => ({ ...d, op: e.target.value }))}
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white"
                  >
                    {OPS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {draft.op !== "null" && draft.op !== "notnull" && (
                    <input
                      value={draft.value}
                      onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                      placeholder="valeur"
                      className="flex-1 min-w-[6rem] border border-slate-200 rounded-md px-2 py-1 text-xs font-mono"
                    />
                  )}
                  <button type="submit" className="text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-2.5 py-1 hover:bg-slate-50">
                    Filtrer
                  </button>
                  <div className="flex-1" />
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setEditor({ mode: "insert" })}
                      className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md"
                    >
                      <Plus size={12} />
                      Ajouter une ligne
                    </button>
                  )}
                </form>
                {query.filters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {query.filters.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px] font-mono bg-slate-100 text-slate-700 rounded-full pl-2.5 pr-1 py-0.5">
                        {f.column} {OP_LABEL[f.op]} {f.value !== undefined && `'${f.value}'`}
                        <button onClick={() => removeFilter(i)} aria-label="Retirer le filtre" className="text-slate-400 hover:text-slate-700 p-0.5">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <DbErrorBox error={error} />

                {page && (
                  <DataGrid
                    page={page}
                    info={info}
                    sort={query.sort}
                    desc={query.desc}
                    onSort={toggleSort}
                    onOpen={(index) => setEditor({ mode: page.editable ? "edit" : "view", index })}
                    onDelete={quickDelete}
                  />
                )}

                {page && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {page.rows.length === 0
                        ? "Aucune ligne"
                        : `Lignes ${query.offset + 1}–${query.offset + page.rows.length}`}
                      {loading && " · chargement..."}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={query.limit}
                        onChange={(e) => setQuery((q) => ({ ...q, limit: Number(e.target.value), offset: 0 }))}
                        className="border border-slate-200 rounded-md px-1.5 py-1 text-xs bg-white"
                      >
                        {PAGE_SIZES.map((n) => (
                          <option key={n} value={n}>
                            {n} / page
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setQuery((q) => ({ ...q, offset: Math.max(0, q.offset - q.limit) }))}
                        disabled={query.offset === 0}
                        className="p-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                        aria-label="Page précédente"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => setQuery((q) => ({ ...q, offset: q.offset + page.rows.length }))}
                        disabled={!page.hasMore}
                        className="p-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                        aria-label="Page suivante"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {info && (
        <RowEditorModal
          open={Boolean(editor)}
          mode={editor?.mode}
          table={info}
          row={editor && editor.mode !== "insert" ? page?.rows[editor.index] : null}
          onSubmit={submitRow}
          onDelete={() => deleteRow(editor.index)}
          onClose={() => setEditor(null)}
        />
      )}
      <CreateTableModal open={createOpen} schemas={catalog.schemas} onCreate={createTable} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function DataGrid({ page, info, sort, desc, onSort, onOpen, onDelete }) {
  const pk = new Set(page.keyColumns);
  const types = Object.fromEntries((info?.columns || []).map((c) => [c.name, c.type]));
  return (
    <div className="overflow-auto max-h-[34rem] border border-slate-200 rounded-lg">
      <table className="min-w-full text-xs font-mono">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr>
            {page.columns.map((c) => (
              <th key={c} className="text-left px-3 py-1.5 border-b border-slate-200 whitespace-nowrap">
                <button onClick={() => onSort(c)} className="flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900" title={types[c]}>
                  {pk.has(c) && <KeyRound size={10} className="text-amber-500" />}
                  {c}
                  {sort === c && (desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                </button>
              </th>
            ))}
            {page.editable && <th className="border-b border-slate-200 w-14" />}
          </tr>
        </thead>
        <tbody>
          {page.rows.length === 0 ? (
            <tr>
              <td colSpan={page.columns.length + 1} className="px-3 py-3 text-slate-400 font-sans">
                Aucune ligne.
              </td>
            </tr>
          ) : (
            page.rows.map((row, r) => (
              <tr key={page.rowIds?.[r] ?? r} onClick={() => onOpen(r)} className="group cursor-pointer odd:bg-white even:bg-slate-50/50 hover:bg-sky-50/60">
                {row.map((v, i) => (
                  <td key={i} className="px-3 py-1 whitespace-nowrap max-w-xs truncate text-slate-700 border-b border-slate-100">
                    <Cell value={v} />
                  </td>
                ))}
                {page.editable && (
                  <td className="px-2 border-b border-slate-100 whitespace-nowrap text-right">
                    <span className="inline-flex gap-1 opacity-60 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); onOpen(r); }} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Modifier">
                        <Pencil size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDelete(r); }} className="p-1 text-slate-400 hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Structure({ info }) {
  if (!info) return <p className="text-sm text-slate-500">Chargement...</p>;
  const pk = new Set(info.primaryKey);
  return (
    <div className="space-y-4">
      <div className="overflow-auto border border-slate-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <th className="px-3 py-1.5 font-semibold">Colonne</th>
              <th className="px-3 py-1.5 font-semibold">Type</th>
              <th className="px-3 py-1.5 font-semibold">NULL</th>
              <th className="px-3 py-1.5 font-semibold">Défaut</th>
            </tr>
          </thead>
          <tbody>
            {info.columns.map((c) => (
              <tr key={c.name} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {pk.has(c.name) && <KeyRound size={11} className="text-amber-500" />}
                    {c.name}
                    {c.identity && <span className="text-[10px] font-sans text-slate-400">identity</span>}
                    {c.generated && <span className="text-[10px] font-sans text-slate-400">générée</span>}
                  </span>
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{c.type}</td>
                <td className="px-3 py-1.5 text-slate-500">{c.nullable ? "oui" : "non"}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500 break-all">{c.default ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {info.constraints.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Contraintes</p>
          <ul className="space-y-1">
            {info.constraints.map((c) => (
              <li key={c.name} className="text-xs">
                <span className="font-mono text-slate-700">{c.name}</span>
                <span className="text-slate-400"> · {c.type}</span>
                <p className="font-mono text-[11px] text-slate-500 break-all">{c.definition}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {info.indexes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Index</p>
          <ul className="space-y-1">
            {info.indexes.map((i) => (
              <li key={i.name} className="font-mono text-[11px] text-slate-500 break-all">
                {i.definition}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
