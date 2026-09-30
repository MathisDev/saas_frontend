import { AlertTriangle } from "lucide-react";

// DbErrorBox affiche une erreur normalisée par dbError (voir lib/dbErrors.js),
// avec le détail et l'indice de Postgres quand il y en a. children : actions
// éventuelles (ex. réessayer avec CASCADE).
export default function DbErrorBox({ error, children }) {
  if (!error) return null;
  return (
    <div className="flex gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-800">
      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-500" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium break-words">{error.message}</p>
        {error.detail && <p className="text-red-700 break-words">{error.detail}</p>}
        {error.hint && <p className="text-red-700 break-words">Indice : {error.hint}</p>}
        {error.sqlState && <p className="text-red-400 font-mono">SQLSTATE {error.sqlState}</p>}
        {children}
      </div>
    </div>
  );
}
