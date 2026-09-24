import { useEffect, useState } from "react";
import { searchLogs } from "../api";

// Metriques retirees d'ici (redondantes : deja par composant sur la page
// environnement, et en detail sur la page Monitoring/Grafana) - ce composant ne
// garde que la recherche dans l'historique des logs, qui n'a pas d'equivalent
// ailleurs (Grafana montre un volume, pas une recherche texte par pod).
export default function Monitoring({ namespace }) {
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function loadLogs(q) {
    setLoadingLogs(true);
    try {
      setLogs(await searchLogs(namespace, { q, size: 100 }));
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    loadLogs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  function handleSearch(e) {
    e.preventDefault();
    loadLogs(query);
  }

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3">Logs (historique, tous pods)</h2>
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="rechercher dans les logs..."
          className="flex-1 border border-slate-300 rounded-md px-3 py-1.5 text-sm"
        />
        <button className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded-md">
          {loadingLogs ? "..." : "Rechercher"}
        </button>
      </form>
      <div className="bg-slate-900 rounded-md p-3 max-h-80 overflow-y-auto space-y-1">
        {logs.map((l, i) => (
          <p key={i} className="text-xs font-mono text-slate-100 whitespace-pre-wrap">
            <span className="text-slate-500">{l.timestamp?.slice(11, 19)}</span>{" "}
            <span className="text-green-400">{l.pod}</span> {l.message}
          </p>
        ))}
        {logs.length === 0 && <p className="text-xs text-slate-500 font-mono">Aucun log.</p>}
      </div>
    </div>
  );
}
