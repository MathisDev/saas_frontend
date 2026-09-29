import { useEffect, useState } from "react";
import { KeyRound, Plus, Eye, EyeOff, Copy, Check, History, Pencil, Trash2, Lock, RotateCcw } from "lucide-react";
import {
  listSecrets,
  createSecret,
  updateSecret,
  deleteSecret,
  revealSecret,
  listSecretVersions,
  rollbackSecret,
} from "../api";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

// SecretsPanel liste les secrets d'un environnement (page NamespaceDetail) : un secret
// appartient à l'environnement, on l'injecte ensuite dans un composant depuis sa page
// (ComponentDetail, "Injecter un secret"). Les valeurs ne sont jamais chargées avec la
// liste - uniquement à la demande (Révéler). Un admin qui consulte l'environnement
// d'un client (canManage faux) n'en voit que les noms.
export default function SecretsPanel({ namespace, onChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function load() {
    try {
      setData(await listSecrets(namespace));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement des secrets");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [namespace]);

  function changed() {
    load();
    onChange?.();
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      await createSecret(namespace, newName.trim(), newValue);
      setNewName("");
      setNewValue("");
      setShowCreate(false);
      changed();
    } catch (err) {
      setCreateError(err.response?.data?.error || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-slate-400" />
          <h2 className="text-sm font-semibold">Secrets</h2>
          {data && (
            <span className="text-xs text-slate-400">
              {data.secrets.length}/{data.limit}
            </span>
          )}
        </div>
        {data?.canManage && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
          >
            <Plus size={14} />
            <span className="sm:hidden">Nouveau</span>
            <span className="hidden sm:inline">Nouveau secret</span>
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        {data && !data.canManage
          ? "Vue admin : noms seulement, les valeurs ne sont visibles que par le propriétaire."
          : "Chiffrés, jamais écrits dans le dépôt GitOps. À injecter dans un composant depuis sa page (Configuration)."}
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 p-3 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5">
          <input
            required
            placeholder="nom (ex: stripe-key)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          <textarea
            required
            rows={2}
            placeholder="valeur"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 sm:flex-none bg-slate-900 text-white text-sm sm:text-xs font-medium px-3 py-2 sm:py-1.5 rounded-md disabled:opacity-50"
            >
              {creating ? "Création..." : "Créer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateError("");
              }}
              className="text-sm sm:text-xs text-slate-500 px-3 py-2 sm:py-1.5"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {data && data.secrets.length === 0 && <p className="text-sm text-slate-500">Aucun secret pour l'instant.</p>}

      <div className="divide-y divide-slate-100">
        {data?.secrets.map((s) => (
          <SecretRow key={s.name} namespace={namespace} secret={s} canManage={data.canManage} onChanged={changed} />
        ))}
      </div>
    </div>
  );
}

function usageLabel(usedBy) {
  return usedBy.map((u) => `${u.component} (${u.envName})`).join(", ");
}

function SecretRow({ namespace, secret, canManage, onChanged }) {
  const [revealed, setRevealed] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState(null); // "edit" | "history" | null
  const [value, setValue] = useState("");
  const [restart, setRestart] = useState(true);
  const [versions, setVersions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const system = secret.managedBy === "system";
  const inUse = secret.usedBy.length > 0;

  async function toggleReveal() {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    setErr("");
    try {
      const res = await revealSecret(namespace, secret.name);
      setRevealed(res.value);
    } catch (e) {
      setErr(e.response?.data?.error || "Impossible de révéler la valeur");
    }
  }

  function copy() {
    navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openHistory() {
    if (mode === "history") {
      setMode(null);
      return;
    }
    setErr("");
    try {
      setVersions(await listSecretVersions(namespace, secret.name));
      setRestart(true);
      setMode("history");
    } catch (e) {
      setErr(e.response?.data?.error || "Impossible de charger l'historique");
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await updateSecret(namespace, secret.name, value, inUse && restart);
      setValue("");
      setMode(null);
      setRevealed(null);
      onChanged();
    } catch (e2) {
      setErr(e2.response?.data?.error || "Erreur lors de la mise à jour");
    } finally {
      setBusy(false);
    }
  }

  async function restore(version) {
    setBusy(true);
    setErr("");
    try {
      await rollbackSecret(namespace, secret.name, version, inUse && restart);
      setMode(null);
      setRevealed(null);
      onChanged();
    } catch (e) {
      setErr(e.response?.data?.error || "Erreur lors de la restauration");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setDeleteError("");
    try {
      await deleteSecret(namespace, secret.name);
      setDeleteOpen(false);
      onChanged();
    } catch (e) {
      const usedBy = e.response?.data?.usedBy;
      setDeleteError(
        usedBy?.length
          ? `Encore injecté dans : ${usageLabel(usedBy)}. Retire-le d'abord de ces composants.`
          : e.response?.data?.error || "Échec de la suppression"
      );
    } finally {
      setBusy(false);
    }
  }

  const restartToggle = inUse && (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      <input type="checkbox" checked={restart} onChange={(e) => setRestart(e.target.checked)} />
      Redémarrer maintenant les composants qui l'utilisent ({usageLabel(secret.usedBy)})
    </label>
  );

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-medium break-all">{secret.name}</span>
          <span className="text-[11px] text-slate-400">v{secret.version}</span>
          {system && (
            <span
              title="Mot de passe d'une base de données : lisible, jamais modifiable"
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-600/10"
            >
              <Lock size={10} />
              système
            </span>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1">
            <IconButton onClick={toggleReveal} title={revealed !== null ? "Masquer" : "Révéler"}>
              {revealed !== null ? <EyeOff size={14} /> : <Eye size={14} />}
            </IconButton>
            {!system && (
              <>
                <IconButton
                  onClick={() => {
                    setMode(mode === "edit" ? null : "edit");
                    setRestart(true);
                    setErr("");
                  }}
                  title="Modifier la valeur"
                >
                  <Pencil size={14} />
                </IconButton>
                <IconButton onClick={openHistory} title="Historique">
                  <History size={14} />
                </IconButton>
                <IconButton onClick={() => setDeleteOpen(true)} title="Supprimer" danger>
                  <Trash2 size={14} />
                </IconButton>
              </>
            )}
          </div>
        )}
      </div>

      {secret.usedBy.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {secret.usedBy.map((u) => (
            <span
              key={`${u.component}-${u.envName}`}
              title={u.pendingRestart ? `v${u.version} injectée - la v${secret.version} attend le prochain redémarrage` : `v${u.version} injectée`}
              className={`text-[11px] font-mono rounded-full px-2 py-0.5 ring-1 ${
                u.pendingRestart ? "bg-amber-50 text-amber-800 ring-amber-600/20" : "bg-slate-50 text-slate-600 ring-slate-200"
              }`}
            >
              {u.component} · {u.envName}
              {u.pendingRestart && " · redémarrage en attente"}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 mt-1">Injecté dans aucun composant</p>
      )}

      {revealed !== null && (
        <div className="flex items-center gap-2 mt-2">
          <code className="flex-1 min-w-0 block bg-slate-50 ring-1 ring-slate-200 rounded p-2.5 text-xs break-all whitespace-pre-wrap">{revealed}</code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 p-2.5 border border-slate-200 rounded-md hover:bg-slate-50 transition"
            title="Copier"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          </button>
        </div>
      )}

      {mode === "edit" && (
        <form onSubmit={submitEdit} className="mt-2 space-y-2">
          <textarea
            required
            rows={2}
            placeholder="nouvelle valeur"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          {restartToggle}
          <button
            type="submit"
            disabled={busy}
            className="bg-slate-900 text-white text-xs font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>
        </form>
      )}

      {mode === "history" && (
        <div className="mt-2 space-y-2">
          <div className="rounded-lg ring-1 ring-slate-200 divide-y divide-slate-100">
            {versions.map((v) => (
              <div key={v.version} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-medium">v{v.version}</span>
                  <span className="text-slate-400">{new Date(v.createdAt).toLocaleString()}</span>
                  {v.current && <span className="text-slate-500">actuelle</span>}
                  {v.inUse && <span className="text-slate-500">· injectée</span>}
                </span>
                {!v.current && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => restore(v.version)}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-800 disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    Restaurer
                  </button>
                )}
              </div>
            ))}
          </div>
          {restartToggle}
        </div>
      )}

      {err && <p className="text-xs text-red-600 mt-1.5">{err}</p>}

      <ConfirmDeleteModal
        open={deleteOpen}
        title="Supprimer le secret"
        description={`Supprime définitivement ${secret.name} et tout son historique. Impossible tant qu'il est injecté dans un composant.`}
        confirmText={secret.name}
        confirmLabel="Nom du secret"
        loading={busy}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError("");
        }}
      />
    </div>
  );
}

function IconButton({ onClick, title, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-md text-slate-400 transition ${danger ? "hover:text-red-600 hover:bg-red-50" : "hover:text-slate-700 hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );
}
