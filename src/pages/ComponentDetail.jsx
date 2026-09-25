import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ExternalLink, GitBranch, Wifi } from "lucide-react";
import { getNamespace, listPods, getComponentsSummary, getPodLogs } from "../api";
import Shell from "../components/Shell";
import Breadcrumb from "../components/Breadcrumb";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";
import { STATUS_STYLE, formatBytes, formatRelativeTime } from "../lib/format";

// ComponentDetail est la page "Détails" ouverte depuis ComponentInfoPopup (voir
// NamespaceDetail/ComponentList) : logs + shell, comme PodDetail, mais
// cadrés sur le composant plutôt que sur un pod précis - logs/exec restant des
// opérations par pod côté API (voir handlers/pods.go), un sélecteur s'affiche
// dès que le composant a plus d'une réplique.
export default function ComponentDetail() {
  const { name, component } = useParams();

  const [ns, setNs] = useState(null);
  const [pods, setPods] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedPod, setSelectedPod] = useState(null);
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [namespace, allPods] = await Promise.all([getNamespace(name), listPods(name)]);
      setNs(namespace);
      setPods(allPods.filter((p) => p.name.startsWith(`${component}-`)));
      try {
        const summary = await getComponentsSummary(name);
        setStats(summary.find((s) => s.component === component) || null);
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
  }, [name, component]);

  // Sélectionne le premier pod par défaut (cas typique : une seule réplique) -
  // recale si ce pod disparaît (redémarrage) tant qu'un autre existe encore.
  useEffect(() => {
    if (pods.length === 0) {
      setSelectedPod(null);
    } else if (!pods.some((p) => p.name === selectedPod)) {
      setSelectedPod(pods[0].name);
    }
  }, [pods]);

  async function loadLogs(podName) {
    try {
      const res = await getPodLogs(name, podName);
      setLogs(res.logs || "(vide)");
    } catch (err) {
      setLogs(err.response?.data?.error || "Erreur");
    }
  }

  useEffect(() => {
    if (!selectedPod) return;
    loadLogs(selectedPod);
    const interval = setInterval(() => loadLogs(selectedPod), 10000);
    return () => clearInterval(interval);
  }, [name, selectedPod]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!ns) return <div className="text-sm text-slate-500">Chargement...</div>;

  const comp = ns.components.find((c) => c.name === component);
  if (!comp) return <div className="text-sm text-red-600">Composant introuvable.</div>;

  const { icon: Icon, accent } = TYPE_STYLE[comp.type] || TYPE_STYLE.custom;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "Environnements", to: "/" },
            { label: name, to: `/namespaces/${name}` },
            { label: comp.name },
          ]}
        />
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
            <Icon size={16} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{comp.name}</h1>
            <p className="text-xs text-slate-500 font-mono">{comp.image}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
              STATUS_STYLE[comp.status] || "bg-slate-100 text-slate-600 ring-slate-600/10"
            }`}
          >
            {comp.status} · {comp.podsReady}/{comp.podsTotal} pods
          </span>
          {comp.url && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-600/10">
              <Wifi size={10} strokeWidth={2.5} />
              public
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-xs mb-4">
          {comp.url && (
            <a href={comp.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-600 font-medium">
              <ExternalLink size={12} />
              {comp.url}
            </a>
          )}
          {comp.repoUrl && (
            <a href={comp.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-500">
              <GitBranch size={12} />
              dépôt GitLab
            </a>
          )}
        </div>

        {stats && (
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2.5 py-1">
              {(stats.cpuCores ?? 0).toFixed(3)} CPU
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2.5 py-1">
              {formatBytes(stats.memoryBytes)}
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2.5 py-1">
              {stats.logCount} logs (1h)
            </span>
            <span
              className={`text-[11px] rounded-full px-2.5 py-1 ring-1 ${
                stats.errorCount > 0
                  ? "text-red-700 bg-red-50 ring-red-600/10 font-medium"
                  : "text-slate-500 bg-slate-50 ring-slate-200"
              }`}
            >
              {stats.errorCount} erreurs (1h)
            </span>
            <span className="text-[11px] text-slate-400 self-center">{formatRelativeTime(stats.lastLogAt)}</span>
          </div>
        )}
      </div>

      {pods.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-slate-500">Aucun pod pour l'instant.</p>
        </div>
      ) : (
        <>
          {pods.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {pods.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setSelectedPod(p.name)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-md border transition ${
                    selectedPod === p.name
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {selectedPod && (
            <>
              <div className="bg-white rounded-xl shadow p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">
                    Logs
                    <Link to={`/namespaces/${name}/pods/${selectedPod}`} className="ml-2 text-xs text-slate-400 font-normal hover:text-slate-600">
                      (détail du pod →)
                    </Link>
                  </h2>
                  <button onClick={() => loadLogs(selectedPod)} className="text-xs text-slate-500">
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
                <Shell namespace={name} pod={selectedPod} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
