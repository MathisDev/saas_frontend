import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trash2, ExternalLink, GitBranch, Plus, Globe } from "lucide-react";
import { getNamespace, deleteNamespace, getComponentsSummary, addComponent } from "../api";
import ComponentList from "../components/ComponentList";
import ComponentInfoPopup from "../components/ComponentInfoPopup";
import Breadcrumb from "../components/Breadcrumb";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { APP_VERSION } from "../version";
import { TYPE_GROUPS, DATABASE_TYPES, TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

function emptyNewComponent() {
  return { name: "", type: "nginx", image: "", expose: false };
}

export default function NamespaceDetail() {
  const { name } = useParams();
  const navigate = useNavigate();

  const [ns, setNs] = useState(null);
  const [componentStats, setComponentStats] = useState({});
  const [error, setError] = useState("");
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
        <p className="text-xs text-slate-500 mb-3">
          Déterminés par ton abonnement, pas modifiables ici - contacte un admin pour en changer.
        </p>
        <div className="flex gap-5 items-center text-sm">
          <span>
            <span className="text-slate-500">CPU </span>
            <span className="font-medium">{ns.cpu}</span>
          </span>
          <span>
            <span className="text-slate-500">Mémoire </span>
            <span className="font-medium">{ns.memory}</span>
          </span>
          <span className="text-xs text-slate-500">
            statut : {ns.status} · {ns.podsReady}/{ns.podsTotal} pods
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Composants</h2>
          <button
            onClick={() => setShowAddComponent((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
          >
            <Plus size={14} />
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

        <div className="mt-4">
          <ComponentList components={ns.components} onSelect={(c) => setSelectedComponent(c.name)} />
        </div>
      </div>

      <ComponentInfoPopup
        namespace={name}
        component={ns.components.find((c) => c.name === selectedComponent) || null}
        stats={selectedComponent ? componentStats[selectedComponent] : null}
        onClose={() => setSelectedComponent(null)}
      />

      <p className="text-xs text-slate-300 text-center">v{APP_VERSION}</p>
    </div>
  );
}
