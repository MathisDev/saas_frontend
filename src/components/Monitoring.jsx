import { useEffect, useState } from "react";
import { getMetrics, searchLogs } from "../api";

function formatBytes(bytes) {
  if (!bytes) return "0 Mo";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} Go` : `${mb.toFixed(0)} Mo`;
}

export default function Monitoring({ namespace }) {
  const [metrics, setMetrics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [query, setQuery] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function loadMetrics() {
    try {
      setMetrics(await getMetrics(namespace));
    } catch {
      // best-effort - ne bloque jamais le reste de la page
    }
  }

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
    loadMetrics();
    loadLogs("");
    const interval = setInterval(loadMetrics, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  function handleSearch(e) {
    e.preventDefault();
    loadLogs(query);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-3">Métriques (usage actuel)</h2>
        {metrics.length === 0 ? (
          <p className="text-xs text-slate-500">
            Pas encore de données (collecte automatique, peut prendre quelques instants après le démarrage d'un pod).
          </p>
        ) : (
          <div className="space-y-2">
            {metrics.map((m) => (
              <div
                key={m.pod}
                className="flex items-center justify-between border border-slate-100 rounded-md px-3 py-2 text-xs"
              >
                <span className="font-mono">{m.pod}</span>
                <span className="text-slate-500">
                  {m.cpuCores.toFixed(3)} CPU · {formatBytes(m.memoryBytes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
