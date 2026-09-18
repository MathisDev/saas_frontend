import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Trash2, ExternalLink } from "lucide-react";
import { getNamespace, deleteNamespace, listPods, updateQuotas, getComponentsSummary } from "../api";
import Monitoring from "../components/Monitoring";
import Breadcrumb from "../components/Breadcrumb";

function formatBytes(bytes) {
  if (!bytes) return "0 Mo";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} Go` : `${mb.toFixed(0)} Mo`;
}

function formatRelativeTime(iso) {
  if (!iso) return "aucune activité récente";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h`;
}

export default function NamespaceDetail() {
  const { name } = useParams();
  const navigate = useNavigate();

  const [ns, setNs] = useState(null);
  const [pods, setPods] = useState([]);
  const [componentStats, setComponentStats] = useState({});
  const [error, setError] = useState("");
  const [cpu, setCpu] = useState("");
  const [memory, setMemory] = useState("");

  async function load() {
    try {
      const data = await getNamespace(name);
      setNs(data);
      setCpu(data.cpu);
      setMemory(data.memory);
      setPods(await listPods(name));
      try {
        const summary = await getComponentsSummary(name);
        setComponentStats(Object.fromEntries(summary.map((s) => [s.component, s])));
      } catch {
        // best-effort - ne bloque jamais le reste de la page
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [name]);

  async function handleDelete() {
    if (!confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return;
    await deleteNamespace(name);
    navigate("/");
  }

  async function handleQuotaSubmit(e) {
    e.preventDefault();
    await updateQuotas(name, { cpu, memory });
    load();
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }
  if (!ns) {
    return <div className="text-sm text-slate-500">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: ns.name }]} />
          <h1 className="text-xl font-semibold">{ns.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {ns.kibanaDashboardUrl && (
            <a
              href={ns.kibanaDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
            >
              <ExternalLink size={14} />
              Dashboard Kibana
            </a>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 transition"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-3">Quotas</h2>
        <form onSubmit={handleQuotaSubmit} className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">CPU</label>
            <input
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm w-24"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Mémoire</label>
            <input
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm w-24"
            />
          </div>
          <button className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded-md">
            Mettre à jour
          </button>
          <span className="text-xs text-slate-500 ml-2">
            statut : {ns.status} · {ns.podsReady}/{ns.podsTotal} pods
          </span>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-3">Composants</h2>
        <div className="space-y-3">
          {ns.components.map((c) => {
            const stats = componentStats[c.name];
            return (
              <div key={c.name} className="border border-slate-100 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">
                    {c.name} <span className="text-slate-400">({c.type})</span>
                  </p>
                  <span className="text-xs text-slate-500">
                    {c.podsReady}/{c.podsTotal} · {c.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{c.image}</p>
                <div className="flex gap-3 mt-2 text-xs">
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-blue-600">
                      {c.url} ↗
                    </a>
                  )}
                  {c.repoUrl && (
                    <a href={c.repoUrl} target="_blank" rel="noreferrer" className="text-slate-500">
                      repo GitLab ↗
                    </a>
                  )}
                </div>
                {c.generatedPassword && (
                  <p className="text-xs text-amber-600 mt-2">
                    Mot de passe généré (affiché une seule fois) : {c.generatedPassword}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  {stats ? (
                    <>
                      <span>{(stats.cpuCores ?? 0).toFixed(3)} CPU</span>
                      <span>{formatBytes(stats.memoryBytes)}</span>
                      <span>{stats.logCount} logs (1h)</span>
                      <span className={stats.errorCount > 0 ? "text-red-600 font-medium" : ""}>
                        {stats.errorCount} erreurs (1h)
                      </span>
                      <span>{formatRelativeTime(stats.lastLogAt)}</span>
                    </>
                  ) : (
                    <span>pas encore de données Elasticsearch</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-3">Pods</h2>
        <div className="space-y-2">
          {pods.map((p) => (
            <Link
              key={p.name}
              to={`/namespaces/${name}/pods/${p.name}`}
              className="flex items-center justify-between border border-slate-100 rounded-md p-3 hover:bg-slate-50 transition"
            >
              <div>
                <p className="text-sm font-mono">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.status} · {p.ready} · {p.restarts} restarts
                </p>
              </div>
              <span className="text-xs text-slate-400">détail, logs, shell →</span>
            </Link>
          ))}
          {pods.length === 0 && <p className="text-sm text-slate-500">Aucun pod pour l'instant.</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <Monitoring namespace={name} />
      </div>
    </div>
  );
}
