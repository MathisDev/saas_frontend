import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link, Navigate } from "react-router-dom";
import { ExternalLink, Wifi, Plus, Trash2, Globe, Settings2, KeyRound, Lock, RotateCw, Database, ArrowRight, ChevronRight, ScrollText, SquareTerminal, RefreshCw, Play } from "lucide-react";
import { getNamespace, listPods, getComponentsSummary, getPodLogs, updateComponent, deleteComponent, listSecrets, listComponentPipelines, runComponentPipeline } from "../api";
import Shell from "../components/Shell";
import Breadcrumb from "../components/Breadcrumb";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import { GitLabIcon, GrafanaIcon } from "../components/BrandIcons";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING, DATABASE_TYPES } from "../lib/componentTypes";
import { STATUS_STYLE, formatBytes, formatRelativeTime } from "../lib/format";
import PipelineList from "../components/pipelines/PipelineList";

// ComponentDetail est la page "Détails" ouverte en cliquant un composant (voir
// NamespaceDetail/ComponentList) : logs + shell, comme PodDetail, mais
// cadrés sur le composant plutôt que sur un pod précis - logs/exec restant des
// opérations par pod côté API (voir handlers/pods.go), un sélecteur s'affiche
// dès que le composant a plus d'une réplique. Un composant postgres renvoie en plus
// vers sa page "Base de données" (DatabasePage).
export default function ComponentDetail() {
  const { name, component } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [ns, setNs] = useState(null);
  const [pods, setPods] = useState([]);
  const [stats, setStats] = useState(null);
  // pipelines : pipelines GitLab du composant (null tant que non lues ou sans dépôt).
  const [pipelines, setPipelines] = useState(null);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [selectedPod, setSelectedPod] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");

  // Formulaire de configuration - initialisé une seule fois par composant (pas à
  // chaque poll de `load()`, sinon une édition en cours serait écrasée toutes les
  // 8s) via configLoaded, remis à false quand on navigue vers un autre composant.
  const [configLoaded, setConfigLoaded] = useState(false);
  const [image, setImage] = useState("");
  const [port, setPort] = useState("");
  const [replicas, setReplicas] = useState(1);
  const [expose, setExpose] = useState(false);
  const [envRows, setEnvRows] = useState([]);
  // secretRows : secrets de l'environnement injectés dans ce composant (nom de
  // variable -> nom de secret), envoyés en secretEnv avec le reste de la config.
  const [secretRows, setSecretRows] = useState([]);
  const [envSecrets, setEnvSecrets] = useState([]);
  const [restarting, setRestarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
      listComponentPipelines(name, component)
        .then((res) => setPipelines(res.hasRepository ? res.pipelines : null))
        .catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [name, component]);

  useEffect(() => {
    setConfigLoaded(false);
    setPipelines(null);
  }, [component]);

  // runPipeline lance une pipeline sur la branche par défaut du dépôt, puis ouvre son détail.
  async function runPipeline() {
    setRunningPipeline(true);
    setPipelineError("");
    try {
      const p = await runComponentPipeline(name, component);
      navigate(`/namespaces/${name}/components/${component}/pipelines/${p.id}`);
    } catch (err) {
      setPipelineError(err.response?.data?.error || "Impossible de lancer la pipeline");
    } finally {
      setRunningPipeline(false);
    }
  }

  useEffect(() => {
    if (configLoaded) return;
    const comp = ns?.components.find((c) => c.name === component);
    if (!comp) return;
    setImage(comp.image);
    setPort(String(comp.port));
    setReplicas(comp.replicas);
    setExpose(Boolean(comp.url));
    setEnvRows(Object.entries(comp.env || {}).map(([key, value]) => ({ key, value })));
    setSecretRows(Object.entries(comp.secretEnv || {}).map(([envName, secret]) => ({ envName, secret })));
    setConfigLoaded(true);
    listSecrets(name)
      .then((res) => setEnvSecrets(res.secrets))
      .catch(() => setEnvSecrets([]));
  }, [ns, component, configLoaded]);

  // Le mot de passe d'une base de données (secret "system" <composant>-password) reste
  // toujours injecté - l'API refuse de le retirer ou de le rediriger.
  function isLockedSecretRow(row) {
    return envSecrets.some((s) => s.name === row.secret && s.managedBy === "system" && s.name === `${component}-password`);
  }

  function updateSecretRow(i, patch) {
    setSecretRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addSecretRow() {
    setSecretRows((rows) => [...rows, { envName: "", secret: envSecrets[0]?.name || "" }]);
  }

  function removeSecretRow(i) {
    setSecretRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  // restartNow régénère le composant sans rien changer : l'API ré-épingle ses secrets
  // sur leur dernière version, ce qui redémarre ses pods.
  async function restartNow() {
    setRestarting(true);
    setSaveError("");
    try {
      await updateComponent(name, component, {});
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Erreur lors du redémarrage");
    } finally {
      setRestarting(false);
    }
  }

  function updateEnvRow(i, patch) {
    setEnvRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addEnvRow() {
    setEnvRows((rows) => [...rows, { key: "", value: "" }]);
  }

  function removeEnvRow(i) {
    setEnvRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function submitConfig(e) {
    e.preventDefault();
    setSaveError("");
    setSaved(false);
    setSaving(true);
    try {
      const env = Object.fromEntries(
        envRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value])
      );
      const secretEnv = Object.fromEntries(
        secretRows.filter((r) => r.envName.trim() && r.secret).map((r) => [r.envName.trim(), r.secret])
      );
      await updateComponent(name, component, {
        image: image.trim(),
        port: Number(port),
        replicas: Number(replicas),
        env,
        secretEnv,
        expose,
      });
      setSaved(true);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.error || "Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteComponent(name, component);
      navigate(`/namespaces/${name}`);
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Échec de la suppression");
    } finally {
      setDeleteLoading(false);
    }
  }

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

  // Les logs sont repliés par défaut : rien n'est lu tant qu'ils restent fermés.
  useEffect(() => {
    if (!selectedPod || !logsOpen) return;
    loadLogs(selectedPod);
    const interval = setInterval(() => loadLogs(selectedPod), 10000);
    return () => clearInterval(interval);
  }, [name, selectedPod, logsOpen]);

  // Anciens liens vers l'onglet "Données", devenu une page à part.
  if (searchParams.get("tab") === "donnees") {
    return <Navigate to={`/namespaces/${name}/components/${component}/database`} replace />;
  }
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!ns) return <div className="text-sm text-slate-500">Chargement...</div>;

  const comp = ns.components.find((c) => c.name === component);
  if (!comp) return <div className="text-sm text-red-600">Composant introuvable.</div>;

  const { icon: Icon, accent } = TYPE_STYLE[comp.type] || TYPE_STYLE.custom;
  const hasDatabasePage = comp.type === "postgres";

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
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
              <Icon size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">{comp.name}</h1>
              <p className="text-xs text-slate-500 font-mono break-all">{comp.image}</p>
            </div>
          </div>
          <button
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 flex items-center justify-center gap-1.5 text-sm text-red-600 bg-white border border-red-200 rounded-md px-3 py-1.5 hover:bg-red-50 transition"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        </div>
      </div>

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Supprimer le composant"
        description={`Supprime définitivement ${comp.name} de ${name}${
          comp.type === "postgres" ? " (données et sauvegardes de sa base comprises)" : ""
        }. Les autres composants de l'environnement ne sont pas affectés. Cette action est irréversible.`}
        confirmText={comp.name}
        confirmLabel="Nom du composant"
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError("");
        }}
      />

      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
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

        <div className="flex flex-wrap gap-2 text-xs mb-4">
          {comp.url && (
            <a
              href={comp.url}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir l'URL publique dans un nouvel onglet"
              className="flex items-center gap-1.5 min-w-0 max-w-full font-medium text-sky-700 bg-sky-50 ring-1 ring-sky-100 rounded-md px-2.5 py-1.5 hover:bg-sky-100 transition"
            >
              <Globe size={13} className="shrink-0" />
              <span className="truncate">{comp.url}</span>
              <ExternalLink size={11} className="shrink-0 opacity-60" />
            </a>
          )}
          {comp.repoUrl && (
            <a
              href={comp.repoUrl}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir le dépôt GitLab dans un nouvel onglet"
              className="flex items-center gap-1.5 min-w-0 font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition"
            >
              <GitLabIcon size={13} />
              <span className="truncate">Dépôt GitLab (code source et pipeline)</span>
              <ExternalLink size={11} className="shrink-0 text-slate-400" />
            </a>
          )}
          {ns.grafanaDashboardUrl && (
            <a
              href={ns.grafanaDashboardUrl}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir le dashboard Grafana dans un nouvel onglet"
              className="flex items-center gap-1.5 min-w-0 font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition"
            >
              <GrafanaIcon size={13} />
              <span className="truncate">Dashboard Grafana (métriques et logs)</span>
              <ExternalLink size={11} className="shrink-0 text-slate-400" />
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

      {hasDatabasePage && (
        <Link
          to={`/namespaces/${name}/components/${comp.name}/database`}
          className="flex items-center justify-center gap-2.5 w-full bg-indigo-600 text-white text-base font-semibold rounded-xl px-5 py-4 shadow hover:bg-indigo-700 active:bg-indigo-800 transition"
        >
          <Database size={20} />
          DB manager
        </Link>
      )}

        <div className="bg-white rounded-xl shadow p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Configuration</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Image, ressources et variables d'environnement - un changement redéploie le composant.
          </p>

          {comp.pendingSecretRestart?.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-amber-800">
                Nouvelle valeur en attente de redémarrage pour{" "}
                <span className="font-mono">{comp.pendingSecretRestart.join(", ")}</span>.
              </p>
              <button
                type="button"
                onClick={restartNow}
                disabled={restarting}
                className="shrink-0 flex items-center justify-center gap-1.5 text-xs font-medium text-amber-900 border border-amber-300 rounded-md px-3 py-1.5 hover:bg-amber-100 transition disabled:opacity-50"
              >
                <RotateCw size={12} className={restarting ? "animate-spin" : ""} />
                Redémarrer maintenant
              </button>
            </div>
          )}

          <form onSubmit={submitConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Image</label>
                <input
                  required
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Port</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Répliques</label>
                <input
                  type="number"
                  min={1}
                  disabled={DATABASE_TYPES.has(comp.type)}
                  value={replicas}
                  onChange={(e) => setReplicas(e.target.value)}
                  className="w-24 border border-slate-300 rounded-md px-3 py-1.5 text-sm disabled:opacity-50 disabled:bg-slate-50"
                />
                {DATABASE_TYPES.has(comp.type) && (
                  <p className="text-[11px] text-slate-400 mt-1">Fixé à 1 pour une base de données.</p>
                )}
              </div>

              {DATABASE_TYPES.has(comp.type) ? (
                <p className="text-xs text-slate-400">Non exposable publiquement</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setExpose((v) => !v)}
                  className="flex items-center gap-2 group/toggle"
                >
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                      expose ? "bg-slate-900" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ transform: expose ? "translateX(18px)" : "translateX(2px)" }}
                    />
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-600 group-hover/toggle:text-slate-900">
                    <Globe size={12} />
                    Exposer publiquement
                  </span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Variables d'environnement
              </label>
              <p className="text-[11px] text-slate-400 mb-2">
                Valeurs en clair, visibles dans la configuration - pour une valeur sensible, injecte un secret
                ci-dessous.
              </p>
              <div className="space-y-2">
                {envRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      placeholder="CLE"
                      value={row.key}
                      onChange={(e) => updateEnvRow(i, { key: e.target.value })}
                      className="flex-1 min-w-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono"
                    />
                    <input
                      placeholder="valeur"
                      value={row.value}
                      onChange={(e) => updateEnvRow(i, { value: e.target.value })}
                      className="flex-1 min-w-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeEnvRow(i)}
                      className="shrink-0 text-slate-400 hover:text-red-600 transition p-1 -m-1"
                      aria-label="Supprimer la variable"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEnvRow}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                >
                  <Plus size={12} />
                  Ajouter une variable
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                <KeyRound size={12} />
                Secrets injectés
              </label>
              <p className="text-[11px] text-slate-400 mb-2 flex flex-wrap items-center gap-1">
                Choisis un secret de l'environnement et le nom de la variable qui le recevra.
                <Link
                  to={`/namespaces/${name}#secrets`}
                  className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                >
                  <KeyRound size={11} />
                  Créer ou modifier un secret
                  <ArrowRight size={11} />
                </Link>
              </p>
              <div className="space-y-2">
                {secretRows.map((row, i) => {
                  const locked = isLockedSecretRow(row);
                  return (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        placeholder="VARIABLE"
                        value={row.envName}
                        disabled={locked}
                        onChange={(e) => updateSecretRow(i, { envName: e.target.value })}
                        className="flex-1 min-w-0 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono disabled:bg-slate-50 disabled:text-slate-500"
                      />
                      <select
                        value={row.secret}
                        disabled={locked}
                        onChange={(e) => updateSecretRow(i, { secret: e.target.value })}
                        className="flex-1 min-w-0 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono bg-white disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        {!envSecrets.some((s) => s.name === row.secret) && <option value={row.secret}>{row.secret || "— secret —"}</option>}
                        {envSecrets.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {locked ? (
                        <span className="shrink-0 text-slate-400 p-1 -m-1" title="Mot de passe de la base de données, toujours injecté">
                          <Lock size={14} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeSecretRow(i)}
                          className="shrink-0 text-slate-400 hover:text-red-600 transition p-1 -m-1"
                          aria-label="Retirer le secret"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {envSecrets.length > 0 ? (
                  <button
                    type="button"
                    onClick={addSecretRow}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <Plus size={12} />
                    Injecter un secret
                  </button>
                ) : (
                  <p className="text-[11px] text-slate-400">Aucun secret dans cet environnement pour l'instant.</p>
                )}
              </div>
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            {saved && <p className="text-sm text-green-600">Configuration mise à jour.</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-slate-900 text-white text-sm font-medium px-4 py-2.5 sm:py-2 rounded-md disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>
        </div>

        {pipelines && (
          <PipelineList
            namespace={name}
            pipelines={pipelines}
            description={pipelineError || "Construction et déploiement de l'image à chaque push sur le dépôt."}
            emptyText="Aucune pipeline pour l'instant : chaque push sur la branche principale du dépôt en déclenche une."
            action={
              <button
                type="button"
                onClick={runPipeline}
                disabled={runningPipeline}
                className="shrink-0 flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <Play size={12} />
                {runningPipeline ? "Lancement..." : "Lancer une pipeline"}
              </button>
            }
          />
        )}

        {pods.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-5">
            <p className="text-sm text-slate-500">Aucun pod pour l'instant.</p>
          </div>
        ) : (
          <>
            {pods.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {pods.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setSelectedPod(p.name)}
                    className={`shrink-0 text-xs font-mono px-3 py-1.5 rounded-md border transition ${
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
                <div className="bg-white rounded-xl shadow p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <SquareTerminal size={15} className="text-slate-400" />
                    <h2 className="text-sm font-semibold">Shell</h2>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Session interactive via WebSocket - vim, top, etc. fonctionnent normalement.
                  </p>
                  <Shell namespace={name} pod={selectedPod} />
                </div>

                <div className="bg-white rounded-xl shadow px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setLogsOpen((v) => !v)}
                      className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
                    >
                      <ChevronRight size={14} className={`transition-transform ${logsOpen ? "rotate-90" : ""}`} />
                      <ScrollText size={13} />
                      {logsOpen ? "Masquer les logs du conteneur" : "Afficher les logs du conteneur"}
                    </button>
                    {logsOpen && (
                      <button
                        onClick={() => loadLogs(selectedPod)}
                        className="shrink-0 flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition"
                      >
                        <RefreshCw size={12} />
                        Actualiser
                      </button>
                    )}
                  </div>
                  {logsOpen && (
                    <pre className="mt-3 bg-slate-900 text-slate-100 text-[11px] sm:text-xs rounded-md p-3 sm:p-4 overflow-auto max-h-72 whitespace-pre-wrap break-all">
                      {logs || "Chargement..."}
                    </pre>
                  )}
                </div>
              </>
            )}
          </>
        )}
    </div>
  );
}
