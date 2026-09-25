import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Trash2, ExternalLink, Wifi, GitBranch, Plus, Globe } from "lucide-react";
import {
  getNamespace,
  deleteNamespace,
  listPods,
  updateQuotas,
  getComponentsSummary,
  addComponent,
} from "../api";
import ComponentNetworkMap from "../components/ComponentNetworkMap";
import Breadcrumb from "../components/Breadcrumb";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { APP_VERSION } from "../version";
import { TYPE_GROUPS, DATABASE_TYPES, TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

function emptyNewComponent() {
  return { name: "", type: "nginx", image: "", expose: false };
}

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newComponent, setNewComponent] = useState(emptyNewComponent());
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

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
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteNamespace(name);
      navigate("/");
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Échec de la suppression");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleQuotaSubmit(e) {
    e.preventDefault();
    await updateQuotas(name, { cpu, memory });
    load();
  }

  async function handleAddComponent(e) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      await addComponent(name, {
        name: newComponent.name.trim(),
        type: newComponent.type,
        expose: newComponent.expose,
        ...(newComponent.type === "custom" && newComponent.image ? { image: newComponent.image } : {}),
      });
      setNewComponent(emptyNewComponent());
      setShowAddComponent(false);
      load();
    } catch (err) {
      setAddError(err.response?.data?.error || "Erreur lors de l'ajout du composant");
    } finally {
      setAddLoading(false);
    }
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
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 transition"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Supprimer l'environnement"
        description={`Supprime définitivement ${name} et tous ses composants (base de données, code, monitoring). Cette action est irréversible.`}
        confirmText={name}
        confirmLabel="Nom de l'environnement"
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError("");
        }}
      />

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

          <button
            onClick={() => setShowAddComponent((v) => !v)}
            className="flex flex-col items-center justify-center gap-2 shrink-0 w-44 p-4 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-200"
          >
            <Plus size={18} />
            Ajouter un composant
          </button>
        </div>

        {showAddComponent && (
          <form
            onSubmit={handleAddComponent}
            className="mt-4 flex gap-3 p-4 rounded-2xl border border-slate-200 bg-slate-50"
          >
            <div
              className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ring-1 ${
                ACCENT_BG[(TYPE_STYLE[newComponent.type] || TYPE_STYLE.custom).accent]
              } ${ACCENT_RING[(TYPE_STYLE[newComponent.type] || TYPE_STYLE.custom).accent]}`}
            >
              {(() => {
                const Icon = (TYPE_STYLE[newComponent.type] || TYPE_STYLE.custom).icon;
                return <Icon size={20} strokeWidth={2} />;
              })()}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex gap-2">
                <input
                  required
                  placeholder="nom du composant"
                  value={newComponent.name}
                  onChange={(e) => setNewComponent((c) => ({ ...c, name: e.target.value }))}
                  className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
                <select
                  value={newComponent.type}
                  onChange={(e) => setNewComponent((c) => ({ ...c, type: e.target.value }))}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  {TYPE_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {newComponent.type === "custom" && (
                <input
                  placeholder="image (ex: registry.example.com/mon-app:latest)"
                  value={newComponent.image}
                  onChange={(e) => setNewComponent((c) => ({ ...c, image: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              )}

              <div className="flex items-center justify-between pt-0.5">
                {DATABASE_TYPES.has(newComponent.type) ? (
                  <p className="text-xs text-slate-400">Non exposable publiquement</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewComponent((c) => ({ ...c, expose: !c.expose }))}
                    className="flex items-center gap-2 group/toggle"
                  >
                    <span
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                        newComponent.expose ? "bg-slate-900" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: newComponent.expose ? "translateX(18px)" : "translateX(2px)" }}
                      />
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-600 group-hover/toggle:text-slate-900">
                      <Globe size={12} />
                      Exposer publiquement
                    </span>
                  </button>
                )}
              </div>

              {addError && <p className="text-sm text-red-600">{addError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
                >
                  {addLoading ? "Ajout..." : "Ajouter"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddComponent(false);
                    setNewComponent(emptyNewComponent());
                    setAddError("");
                  }}
                  className="text-xs text-slate-500 px-3 py-1.5"
                >
                  Annuler
                </button>
              </div>
            </div>
          </form>
        )}

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
        <h2 className="text-sm font-semibold mb-4">Carte réseau</h2>
        <ComponentNetworkMap components={ns.components} />
      </div>

      <p className="text-xs text-slate-300 text-center">v{APP_VERSION}</p>
    </div>
  );
}
