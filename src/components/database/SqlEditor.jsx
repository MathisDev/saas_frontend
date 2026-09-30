import { useEffect, useRef, useState } from "react";
import { Play, CheckCircle2, Undo2 } from "lucide-react";
import { runDatabaseQuery } from "../../api";
import { dbError } from "../../lib/dbErrors";
import ResultGrid from "./ResultGrid";
import DbErrorBox from "./DbErrorBox";

// Le brouillon de l'éditeur est gardé par navigateur et par composant - simple
// confort, jamais indispensable (stockage indisponible : on repart d'un éditeur vide).
function draftKey(namespace, component) {
  return `sql-draft:${namespace}/${component}`;
}

function loadDraft(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function saveDraft(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : sans conséquence
  }
}

// lineCol convertit la position d'une erreur Postgres (1-based, en caractères
// dans le SQL soumis) en "ligne L, colonne C".
function lineCol(sql, position) {
  const before = [...sql].slice(0, position - 1).join("");
  const lines = before.split("\n");
  return `ligne ${lines.length}, colonne ${lines[lines.length - 1].length + 1}`;
}

// SqlEditor exécute du SQL libre (plusieurs instructions séparées par des ";",
// ou seulement la sélection). Les transactions sont manuelles : après un BEGIN, la
// connexion de l'éditeur reste dans la transaction jusqu'au COMMIT/ROLLBACK.
export default function SqlEditor({ namespace, component, run }) {
  const key = draftKey(namespace, component);
  const [sql, setSql] = useState(() => loadDraft(key));
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState(null); // {sql, result}
  const [error, setError] = useState(null);
  const [tx, setTx] = useState({ open: false, failed: false });
  // Session dans laquelle la transaction a été ouverte : si la session a été
  // rouverte depuis (expiration), la transaction est perdue et rien ne doit être
  // rejoué sur la nouvelle session - un COMMIT y validerait... rien.
  const txSession = useRef(null);
  const textarea = useRef(null);

  useEffect(() => {
    saveDraft(key, sql);
  }, [key, sql]);

  async function execute(text) {
    if (!text.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const result = await run(
        (sid) => {
          if (txSession.current && sid !== txSession.current) {
            const lost = new Error("transaction lost");
            lost.response = { data: { code: "connection_lost" } };
            throw lost;
          }
          return runDatabaseQuery(namespace, component, sid, text).then((res) => ({ res, sid }));
        },
        { retry: !tx.open }
      );
      setOutcome({ sql: text, result: result.res });
      setTx({ open: result.res.inTransaction, failed: result.res.transactionFailed });
      txSession.current = result.res.inTransaction ? result.sid : null;
    } catch (err) {
      const e = dbError(err);
      setError(e);
      if (e.code === "connection_lost" || e.code === "session_expired") {
        setTx({ open: false, failed: false });
        txSession.current = null;
        if (e.code === "session_expired" && tx.open) {
          setError({ ...e, message: "Session expirée : la transaction en cours a été annulée." });
        }
      }
    } finally {
      setRunning(false);
    }
  }

  // Exécute la sélection s'il y en a une, sinon tout l'éditeur.
  function runEditor() {
    const el = textarea.current;
    const selection = el && el.selectionStart !== el.selectionEnd ? sql.slice(el.selectionStart, el.selectionEnd) : "";
    execute(selection.trim() ? selection : sql);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runEditor();
    }
  }

  const result = outcome?.result;

  return (
    <div className="space-y-3">
      <textarea
        ref={textarea}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        placeholder={"SELECT * FROM ma_table LIMIT 10;\n\n-- BEGIN; ... puis Valider ou Annuler"}
        className="w-full min-h-[10rem] resize-y bg-slate-900 text-slate-100 placeholder:text-slate-500 font-mono text-xs leading-relaxed rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runEditor}
          disabled={running || !sql.trim()}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          <Play size={12} />
          {running ? "Exécution..." : "Exécuter"}
        </button>
        <span className="text-[11px] text-slate-400 hidden sm:inline">⌘/Ctrl + Entrée · la sélection seule si elle existe</span>
        <div className="flex-1" />
        {tx.open && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
                tx.failed ? "bg-red-50 text-red-700 ring-red-600/20" : "bg-amber-50 text-amber-800 ring-amber-600/20"
              }`}
            >
              {tx.failed ? "Transaction en échec : annule-la" : "Transaction ouverte"}
            </span>
            {!tx.failed && (
              <button
                onClick={() => execute("COMMIT")}
                disabled={running}
                className="flex items-center gap-1 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-md px-2.5 py-1 hover:bg-emerald-50 disabled:opacity-50"
              >
                <CheckCircle2 size={12} />
                Valider
              </button>
            )}
            <button
              onClick={() => execute("ROLLBACK")}
              disabled={running}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md px-2.5 py-1 hover:bg-slate-50 disabled:opacity-50"
            >
              <Undo2 size={12} />
              Annuler
            </button>
          </div>
        )}
      </div>

      <DbErrorBox error={error} />

      {result && (
        <div className="space-y-3">
          {result.error && (
            <DbErrorBox
              error={{
                message: result.error.message,
                detail: result.error.detail,
                hint: result.error.hint,
                sqlState: result.error.code,
              }}
            >
              {result.error.position > 0 && (
                <p className="text-red-500">Position : {lineCol(outcome.sql, result.error.position)}</p>
              )}
              {result.results.length > 0 && (
                <p className="text-red-500">
                  {result.results.length} instruction{result.results.length > 1 ? "s" : ""} exécutée
                  {result.results.length > 1 ? "s" : ""} avant l'erreur (résultats ci-dessous).
                  {!tx.open && " Sans BEGIN, Postgres les a annulées avec l'erreur."}
                </p>
              )}
            </DbErrorBox>
          )}
          {result.results.map((r, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-[11px] text-slate-500">
                <span className="font-mono font-medium text-slate-700">{r.command || "(vide)"}</span>
                {r.columns && ` · ${r.rowCount} ligne${r.rowCount > 1 ? "s" : ""}`}
                {r.truncated && ` · ${r.rows.length} affichées`}
                {i === result.results.length - 1 && ` · ${result.durationMs} ms`}
              </p>
              <ResultGrid columns={r.columns} rows={r.rows || []} />
            </div>
          ))}
          {result.results.length === 0 && !result.error && <p className="text-xs text-slate-400">Aucune instruction exécutée.</p>}
        </div>
      )}
    </div>
  );
}
