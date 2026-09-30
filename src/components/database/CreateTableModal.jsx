import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { dbError } from "../../lib/dbErrors";
import DbErrorBox from "./DbErrorBox";

// Types proposés à la saisie - le champ reste libre, tout type Postgres est accepté.
const COMMON_TYPES = [
  "bigserial",
  "serial",
  "bigint",
  "integer",
  "numeric(12,2)",
  "text",
  "varchar(255)",
  "boolean",
  "timestamptz",
  "date",
  "uuid",
  "jsonb",
  "bytea",
];

function initialColumns() {
  return [
    { name: "id", type: "bigserial", nullable: false, default: "", primaryKey: true },
    { name: "", type: "text", nullable: true, default: "", primaryKey: false },
  ];
}

// CreateTableModal crée une table : nom, schéma, et une ligne par colonne (type
// et défaut en SQL brut, ex. "now()" ou "gen_random_uuid()").
export default function CreateTableModal({ open, schemas, onCreate, onClose }) {
  const [schema, setSchema] = useState("public");
  const [name, setName] = useState("");
  const [columns, setColumns] = useState(initialColumns);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSchema(schemas.includes("public") ? "public" : schemas[0] || "public");
      setName("");
      setColumns(initialColumns());
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function updateColumn(i, patch) {
    setColumns((cols) => cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate(
        schema,
        name.trim(),
        columns.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim(), type: c.type.trim() }))
      );
    } catch (err) {
      setError(dbError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-panel sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sheet-grabber" />
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Nouvelle table</h2>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 -m-2 p-2">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Schéma</label>
              <select
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono bg-white"
              >
                {(schemas.length ? schemas : ["public"]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nom de la table</label>
              <input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="clients"
                className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Colonnes</label>
            <datalist id="pg-common-types">
              {COMMON_TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <div className="space-y-2">
              {columns.map((c, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_9rem_8rem_auto_auto_auto] gap-2 items-center">
                  <input
                    placeholder="nom"
                    value={c.name}
                    onChange={(e) => updateColumn(i, { name: e.target.value })}
                    className="min-w-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    placeholder="type"
                    list="pg-common-types"
                    value={c.type}
                    onChange={(e) => updateColumn(i, { type: e.target.value })}
                    className="min-w-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    placeholder="défaut"
                    value={c.default}
                    onChange={(e) => updateColumn(i, { default: e.target.value })}
                    className="min-w-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={c.nullable}
                      onChange={(e) => updateColumn(i, { nullable: e.target.checked })}
                    />
                    NULL
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={c.primaryKey}
                      onChange={(e) => updateColumn(i, { primaryKey: e.target.checked, nullable: e.target.checked ? false : c.nullable })}
                    />
                    Clé
                  </label>
                  <button
                    type="button"
                    onClick={() => setColumns((cols) => cols.filter((_, idx) => idx !== i))}
                    className="justify-self-end text-slate-400 hover:text-red-600 transition p-1 -m-1"
                    aria-label="Retirer la colonne"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setColumns((cols) => [...cols, { name: "", type: "text", nullable: true, default: "", primaryKey: false }])}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                <Plus size={12} />
                Ajouter une colonne
              </button>
            </div>
          </div>

          <DbErrorBox error={error} />

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-sm text-slate-500 px-4 py-3 sm:py-2 hover:bg-slate-50 rounded-lg sm:rounded-md transition disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-3 sm:py-2 rounded-lg sm:rounded-md disabled:opacity-50"
            >
              {busy ? "Création..." : "Créer la table"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
