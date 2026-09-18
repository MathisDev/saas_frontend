import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPod, getPodLogs } from "../api";
import Shell from "../components/Shell";
import Breadcrumb from "../components/Breadcrumb";

export default function PodDetail() {
  const { name, pod } = useParams();

  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");

  async function loadDetail() {
    try {
      setDetail(await getPod(name, pod));
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    }
  }

  async function loadLogs() {
    try {
      const res = await getPodLogs(name, pod);
      setLogs(res.logs || "(vide)");
    } catch (err) {
      setLogs(err.response?.data?.error || "Erreur");
    }
  }

  useEffect(() => {
    loadDetail();
    loadLogs();
    const interval = setInterval(() => {
      loadDetail();
      loadLogs();
    }, 10000);
    return () => clearInterval(interval);
  }, [name, pod]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!detail) return <div className="text-sm text-slate-500">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "Environnements", to: "/" },
            { label: name, to: `/namespaces/${name}` },
            { label: pod },
          ]}
        />
        <h1 className="text-xl font-semibold font-mono">{pod}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {detail.phase} · nœud {detail.node} · IP {detail.podIp} · démarré {detail.startTime}
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-3">Specs des conteneurs</h2>
        <div className="space-y-3">
          {detail.containers.map((c) => (
            <div key={c.name} className="border border-slate-100 rounded-md p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{c.name}</p>
                <span className={c.ready ? "text-green-600" : "text-amber-600"}>{c.state}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">{c.image}</p>
              <p className="text-xs text-slate-500 mt-1">
                requests {c.requestsCpu} / {c.requestsMemory} · limits {c.limitsCpu} / {c.limitsMemory} ·{" "}
                {c.restartCount} restarts
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Logs</h2>
          <button onClick={loadLogs} className="text-xs text-slate-500">
            actualiser
          </button>
        </div>
        <pre className="bg-slate-900 text-slate-100 text-xs rounded-md p-4 overflow-x-auto max-h-72 whitespace-pre-wrap">
          {logs}
        </pre>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-1">Shell</h2>
        <p className="text-xs text-slate-500 mb-3">
          Session interactive via WebSocket - vim, top, etc. fonctionnent normalement.
        </p>
        <Shell namespace={name} pod={pod} />
      </div>
    </div>
  );
}
