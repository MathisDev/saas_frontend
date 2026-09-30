import { useEffect, useState } from "react";
import { KeyRound, Trash2, X } from "lucide-react";
import { dbError } from "../../lib/dbErrors";
import DbErrorBox from "./DbErrorBox";

// État d'un champ : une valeur saisie, NULL, ou (à l'ajout) la valeur par défaut
// de la colonne - trois cas qu'un simple champ texte ne distingue pas.
function initialFields(table, mode, row) {
  return table.columns.map((col, i) => {
    if (mode === "insert") {
      const hasDefault = col.default !== null || col.identity || col.generated;
      return { mode: hasDefault ? "default" : col.nullable ? "null" : "value", value: "" };
    }
    const v = row?.[i];
    return { mode: v === null ? "null" : "value", value: v ?? "" };
  });
}

function isLong(col, value) {
  return /json|text|xml/.test(col.type) && (value.length > 60 || value.includes("\n"));
}

// RowEditorModal ajoute (mode "insert"), modifie ("edit") ou affiche ("view", table
// en lecture seule) une ligne. À la modification, seules les colonnes changées
// sont envoyées.
export default function RowEditorModal({ open, mode, table, row, onSubmit, onDelete, onClose }) {
  const [fields, setFields] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setFields(initialFields(table, mode, row));
      setError(null);
    }
  }, [open, mode, table, row]);

  if (!open || fields.length !== table.columns.length) return null;

  const readOnly = mode === "view";
  const pk = new Set(table.primaryKey);

  function setField(i, patch) {
    setFields((all) => all.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function collectValues() {
    const values = {};
    table.columns.forEach((col, i) => {
      if (col.generated) return;
      const f = fields[i];
      if (mode === "insert") {
        if (f.mode === "value") values[col.name] = f.value;
        else if (f.mode === "null") values[col.name] = null;
        return;
      }
      const original = row[i];
      const next = f.mode === "null" ? null : f.value;
      if (next !== original) values[col.name] = next;
    });
    return values;
  }

  async function submit(e) {
    e.preventDefault();
    const values = collectValues();
    if (mode === "edit" && Object.keys(values).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(dbError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(dbError(err));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "insert" ? "Ajouter une ligne" : mode === "edit" ? "Modifier la ligne" : "Ligne";

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal-panel sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sheet-grabber" />
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-900">
            {title}
            <span className="ml-2 font-mono font-normal text-xs text-slate-400">
              {table.schema}.{table.name}
            </span>
          </h2>
          <button onClick={onClose} disabled={busy} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 -m-2 p-2">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {table.columns.map((col, i) => {
            const f = fields[i];
            const locked = readOnly || col.generated;
            const hasDefault = col.default !== null || col.identity;
            const placeholder =
              f.mode === "null" ? "NULL" : f.mode === "default" ? `défaut${col.default ? ` : ${col.default}` : ""}` : "";
            const inputClass = `w-full border rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
              f.mode === "value" ? "border-slate-300" : "border-slate-200 bg-slate-50 placeholder:italic"
            } disabled:bg-slate-50 disabled:text-slate-500`;
            const inputProps = {
              value: f.mode === "value" ? f.value : "",
              placeholder,
              disabled: locked,
              onChange: (e) => setField(i, { mode: "value", value: e.target.value }),
              className: inputClass,
            };
            return (
              <div key={col.name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="flex items-center gap-1.5 min-w-0 text-xs font-medium text-slate-700 font-mono">
                    {pk.has(col.name) && <KeyRound size={11} className="text-amber-500 shrink-0" />}
                    <span className="truncate">{col.name}</span>
                    <span className="font-normal text-slate-400 truncate">{col.type}</span>
                  </label>
                  {!locked && (
                    <div className="flex gap-1 shrink-0">
                      {col.nullable && (
                        <button
                          type="button"
                          onClick={() => setField(i, { mode: f.mode === "null" ? "value" : "null" })}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            f.mode === "null" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          NULL
                        </button>
                      )}
                      {mode === "insert" && hasDefault && (
                        <button
                          type="button"
                          onClick={() => setField(i, { mode: f.mode === "default" ? "value" : "default" })}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            f.mode === "default" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          défaut
                        </button>
                      )}
                    </div>
                  )}
                  {col.generated && <span className="text-[10px] text-slate-400">générée</span>}
                </div>
                {isLong(col, f.value) ? <textarea rows={4} {...inputProps} /> : <input {...inputProps} />}
              </div>
            );
          })}

          <DbErrorBox error={error} />

          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pt-2">
            {mode === "edit" && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="flex items-center justify-center gap-1.5 text-sm text-red-600 px-3 py-3 sm:py-2 rounded-lg sm:rounded-md hover:bg-red-50 transition disabled:opacity-40 sm:mr-auto"
              >
                <Trash2 size={14} />
                Supprimer la ligne
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-sm text-slate-500 px-4 py-3 sm:py-2 hover:bg-slate-50 rounded-lg sm:rounded-md transition disabled:opacity-40 sm:ml-auto"
            >
              {readOnly ? "Fermer" : "Annuler"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={busy}
                className="bg-slate-900 text-white text-sm font-medium px-4 py-3 sm:py-2 rounded-lg sm:rounded-md disabled:opacity-50"
              >
                {busy ? "Enregistrement..." : mode === "insert" ? "Ajouter" : "Enregistrer"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
