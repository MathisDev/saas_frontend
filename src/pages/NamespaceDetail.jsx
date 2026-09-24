import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Trash2, ExternalLink, Wifi, GitBranch } from "lucide-react";
import { getNamespace, deleteNamespace, listPods, updateQuotas, getComponentsSummary } from "../api";
import Monitoring from "../components/Monitoring";
import Breadcrumb from "../components/Breadcrumb";
import { APP_VERSION } from "../version";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

const STATUS_STYLE = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  Provisioning: "bg-amber-50 text-amber-700 ring-amber-600/10",
  Failed: "bg-red-50 text-red-700 ring-red-600/10",
};

function formatBytes(bytes) {
  if (!bytes) return "0 Mo";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} Go` : `${mb.toFixed(0)} Mo`;
}

// ComponentNode est une carte du plan des composants (voir section "Composants").
// Pas de traits reliant les cartes entre elles : chaque composant a son propre
// Deployment+Service independant (cf gitops.GenerateComponentManifests), les
// relier suggererait une dependance qui n'existe pas. Le seul vrai lien a montrer
// est l'exposition publique (badge "Public" - Ingress genere, cf handlers/dto.go
// ComponentInput.Expose), pas une chaine entre composants.
function ComponentNode({ c, selected, onClick }) {
  const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col gap-3 text-left shrink-0 w-44 p-4 rounded-2xl border bg-white transition-all duration-200 ease-out ${
        selected
          ? "border-slate-900 ring-1 ring-slate-900 shadow-md"
          : "border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-slate-300"
      }`}
    >
      {c.url && (
        <span className="absolute -top-2 -right-2 flex items-center gap-1 bg-sky-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm">
          <Wifi size={10} strokeWidth={2.5} />
          public
        </span>
      )}

      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
        <Icon size={18} strokeWidth={2} />
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{c.type}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
      </div>

      <span
        className={`self-start inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
          STATUS_STYLE[c.status] || "bg-slate-100 text-slate-600 ring-slate-600/10"
        }`}
      >
        {c.podsReady}/{c.podsTotal} pods
      </span>
    </button>
  );
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
  const [selectedComponent, setSelectedComponent] = useState(null);

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
          {ns.manifestRepoUrl && (
            <a
              href={ns.manifestRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
            >
              <GitBranch size={14} />
              Dépôt de manifests
            </a>
          )}
          {ns.grafanaDashboardUrl && (
            <a
              href={ns.grafanaDashboardUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
            >
              <ExternalLink size={14} />
              Dashboard Grafana
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
        <h2 className="text-sm font-semibold mb-4">Composants</h2>

        <div className="flex flex-wrap gap-3">
          {ns.components.map((c) => (
            <ComponentNode
              key={c.name}
              c={c}
              selected={selectedComponent === c.name}
              onClick={() => setSelectedComponent(selectedComponent === c.name ? null : c.name)}
            />
          ))}
          {ns.components.length === 0 && (
            <p className="text-sm text-slate-500">Aucun composant pour l'instant.</p>
          )}
        </div>

        {ns.components
          .filter((c) => c.name === selectedComponent)
          .map((c) => {
            const stats = componentStats[c.name];
            const componentPods = pods.filter((p) => p.name.startsWith(`${c.name}-`));
            const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
            return (
              <div key={c.name} className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                      <p className="text-xs text-slate-500 font-mono truncate">{c.image}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
                      STATUS_STYLE[c.status] || "bg-slate-100 text-slate-600 ring-slate-600/10"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <div className="flex gap-3 mt-3 text-xs">
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-sky-600 font-medium">
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
                  <p className="text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-600/10 rounded-md px-2.5 py-1.5 mt-3">
                    Mot de passe généré (affiché une seule fois) : {c.generatedPassword}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {stats ? (
                    <>
                      <span className="text-[11px] text-slate-500 bg-white ring-1 ring-slate-200 rounded-full px-2.5 py-1">
                        {(stats.cpuCores ?? 0).toFixed(3)} CPU
                      </span>
                      <span className="text-[11px] text-slate-500 bg-white ring-1 ring-slate-200 rounded-full px-2.5 py-1">
                        {formatBytes(stats.memoryBytes)}
                      </span>
                      <span className="text-[11px] text-slate-500 bg-white ring-1 ring-slate-200 rounded-full px-2.5 py-1">
                        {stats.logCount} logs (1h)
                      </span>
                      <span
                        className={`text-[11px] rounded-full px-2.5 py-1 ring-1 ${
                          stats.errorCount > 0
                            ? "text-red-700 bg-red-50 ring-red-600/10 font-medium"
                            : "text-slate-500 bg-white ring-slate-200"
                        }`}
                      >
                        {stats.errorCount} erreurs (1h)
                      </span>
                      <span className="text-[11px] text-slate-400 self-center">
                        {formatRelativeTime(stats.lastLogAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400">pas encore de données</span>
                  )}
                </div>

                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mt-5 mb-2">Pods</p>
                <div className="space-y-2">
                  {componentPods.map((p) => (
                    <Link
                      key={p.name}
                      to={`/namespaces/${name}/pods/${p.name}`}
                      className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 hover:shadow-sm transition"
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
                  {componentPods.length === 0 && (
                    <p className="text-sm text-slate-500">Aucun pod pour l'instant.</p>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <Monitoring namespace={name} />
      </div>

      <p className="text-xs text-slate-300 text-center">v{APP_VERSION}</p>
    </div>
  );
}
