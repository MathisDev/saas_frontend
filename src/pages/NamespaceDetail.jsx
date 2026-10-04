import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Trash2, ExternalLink, Plus, Globe, RefreshCw, Boxes, Gauge } from "lucide-react";
import { GrafanaIcon } from "../components/BrandIcons";
import { getNamespace, deleteNamespace, getComponentsSummary, addComponent, refreshNamespace, getNamespacePipelines } from "../api";
import ComponentList from "../components/ComponentList";
import ComponentInfoPopup from "../components/ComponentInfoPopup";
import Breadcrumb from "../components/Breadcrumb";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import GeneratedPasswords from "../components/GeneratedPasswords";
import SecretsPanel from "../components/SecretsPanel";
import { APP_VERSION } from "../version";
import { TYPE_GROUPS, DATABASE_TYPES, TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

function emptyNewComponent() {
  return { name: "", type: "nginx", image: "", expose: false };
}

export default function NamespaceDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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
  // addedSecrets : composant base de données tout juste ajouté dont l'API a généré le
  // mot de passe - affiché une fois ici, puis consultable dans les secrets de
  // l'environnement (voir GeneratedPasswords, SecretsPanel).
  const [addedSecrets, setAddedSecrets] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  // pipelines : dernière pipeline GitLab de chaque composant (badge de la liste).
  const [pipelines, setPipelines] = useState({});
  const [refreshError, setRefreshError] = useState("");

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
      getNamespacePipelines(name)
        .then((all) => setPipelines(Object.fromEntries(all.filter((p) => p.pipeline).map((p) => [p.component, p.pipeline]))))
        .catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [name]);

  // Défilement vers la section ciblée par l'ancre (#secrets, lien depuis la page d'un
  // composant) une fois la page chargée - React Router ne le fait pas lui-même.
  useEffect(() => {
    if (!ns || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ns, location.hash]);

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

  // handleRefresh demande à ArgoCD de resynchroniser immédiatement cet environnement
  // (voir handlers.NamespaceHandler.Refresh) - utile après un déploiement via la
  // pipeline CI/CD d'un composant, ou en cas de doute ; sans effet visible si tout
  // est déjà synchronisé (ArgoCD resynchronise de toute façon en continu). 429 si un
  // refresh a déjà été demandé il y a moins de 10 secondes.
  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError("");
    try {
      await refreshNamespace(name);
      load();
    } catch (err) {
      setRefreshError(err.response?.data?.error || "Échec de la resynchronisation");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddComponent(e) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      const created = await addComponent(name, {
        name: newComponent.name.trim(),
        type: newComponent.type,
        expose: newComponent.expose,
        ...(newComponent.type === "custom" && newComponent.image ? { image: newComponent.image } : {}),
      });
      setAddedSecrets(created.generatedPassword ? [created] : []);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: ns.name }]} />
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 text-slate-600 ring-1 ring-slate-200">
              <Boxes size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{ns.name}</h1>
              <p className="text-xs text-slate-500">Composants, secrets et quotas de l'environnement</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ns.grafanaDashboardUrl && (
            <a
              href={ns.grafanaDashboardUrl}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir le dashboard Grafana dans un nouvel onglet"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-2 sm:py-1.5 hover:bg-slate-50 transition"
            >
              <GrafanaIcon size={14} />
              Dashboard Grafana
              <ExternalLink size={12} className="text-slate-400" />
            </a>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Resynchroniser avec ArgoCD"
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-2 sm:py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Resynchroniser
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-sm text-red-600 bg-white border border-red-200 rounded-md px-3 py-2 sm:py-1.5 hover:bg-red-50 transition"
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

      {refreshError && <p className="text-sm text-red-600">{refreshError}</p>}

      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Gauge size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold">Quotas</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Déterminés par ton abonnement, pas modifiables ici - contacte un admin pour en changer.
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 items-center text-sm">
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

      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Boxes size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold">Composants</h2>
            </div>
            <p className="text-xs text-slate-500">Clique sur un composant pour son résumé, ses liens et ses détails.</p>
          </div>
          <button
            onClick={() => setShowAddComponent((v) => !v)}
            className="shrink-0 flex items-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
          >
            <Plus size={14} />
            <span className="sm:hidden">Ajouter</span>
            <span className="hidden sm:inline">Ajouter un composant</span>
          </button>
        </div>

        {showAddComponent && (
          <form
            onSubmit={handleAddComponent}
            className="mt-4 flex gap-3 p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50"
          >
            <div
              className={`hidden sm:flex shrink-0 w-11 h-11 rounded-xl items-center justify-center ring-1 ${
                ACCENT_BG[(TYPE_STYLE[newComponent.type] || TYPE_STYLE.custom).accent]
              } ${ACCENT_RING[(TYPE_STYLE[newComponent.type] || TYPE_STYLE.custom).accent]}`}
            >
              {(() => {
                const Icon = (TYPE_STYLE[newComponent.type] || TYPE_STYLE.custom).icon;
                return <Icon size={20} strokeWidth={2} />;
              })()}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <input
                  required
                  placeholder="nom du composant"
                  value={newComponent.name}
                  onChange={(e) => setNewComponent((c) => ({ ...c, name: e.target.value }))}
                  className="flex-1 basis-40 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
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
                  className="flex-1 sm:flex-none bg-slate-900 text-white text-sm sm:text-xs font-medium px-3 py-2 sm:py-1.5 rounded-md disabled:opacity-50"
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
                  className="text-sm sm:text-xs text-slate-500 px-3 py-2 sm:py-1.5"
                >
                  Annuler
                </button>
              </div>
            </div>
          </form>
        )}

        {addedSecrets.length > 0 && (
          <div className="mt-4 space-y-2">
            <GeneratedPasswords components={addedSecrets} />
            <button
              type="button"
              onClick={() => setAddedSecrets([])}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              J'ai copié le mot de passe
            </button>
          </div>
        )}

        <div className="mt-4">
          <ComponentList components={ns.components} pipelines={pipelines} onSelect={(c) => setSelectedComponent(c.name)} />
        </div>
      </div>

      <div id="secrets" className="scroll-mt-4">
        <SecretsPanel namespace={name} onChange={load} />
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
