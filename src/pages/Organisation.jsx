import { useEffect, useMemo, useState } from "react";
import { KeyRound, Trash2, Copy, Check, ShieldCheck, Search, UserX } from "lucide-react";
import {
  adminListClients,
  adminResetClientPassword,
  adminDeleteClient,
  adminSuspendClient,
  adminUpdateClientTier,
  adminGetSettings,
  adminUpdateSettings,
} from "../api";
import { useAuth } from "../context/AuthContext";
import Breadcrumb from "../components/Breadcrumb";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

function Toggle({ on, onClick, disabled, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 disabled:opacity-40 ${
        on ? "bg-slate-900" : "bg-slate-200"
      }`}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export default function Organisation() {
  const { me } = useAuth();
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [registrationEnabled, setRegistrationEnabled] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  async function load() {
    try {
      setClients(await adminListClients());
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const data = await adminGetSettings();
      setRegistrationEnabled(data.registrationEnabled);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement des réglages");
    }
  }

  useEffect(() => {
    load();
    loadSettings();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.email.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [clients, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.clientId));

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.clientId));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((c) => next.add(c.clientId));
      return next;
    });
  }

  async function handleToggleRegistration() {
    setSettingsLoading(true);
    setError("");
    try {
      const data = await adminUpdateSettings(!registrationEnabled);
      setRegistrationEnabled(data.registrationEnabled);
    } catch (err) {
      setError(err.response?.data?.error || "Échec de la mise à jour des réglages");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleTierChange(client, tier) {
    if (tier === client.tier) return;
    setBusyId(client.clientId);
    setError("");
    try {
      await adminUpdateClientTier(client.clientId, tier);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Échec du changement d'abonnement");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleSuspend(client) {
    setBusyId(client.clientId);
    setError("");
    try {
      await adminSuspendClient(client.clientId, !client.suspended);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de la mise à jour");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(client) {
    if (!confirm(`Réinitialiser le mot de passe de ${client.email} ? L'ancien cessera immédiatement de fonctionner.`)) return;
    setBusyId(client.clientId);
    setError("");
    try {
      const password = await adminResetClientPassword(client.clientId);
      setResetResult({ email: client.email, password });
    } catch (err) {
      setError(err.response?.data?.error || "Échec de la réinitialisation");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    const client = deleteTarget;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await adminDeleteClient(client.clientId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(client.clientId);
        return next;
      });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Échec de la suppression");
    } finally {
      setDeleteLoading(false);
    }
  }

  function openBulkDelete() {
    if (selected.has(me?.clientId)) {
      setError("Tu ne peux pas te supprimer toi-même - retire ton compte de la sélection.");
      return;
    }
    setError("");
    setDeleteError("");
    setBulkConfirmOpen(true);
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;

    setBulkBusy(true);
    setDeleteError("");
    const failures = [];
    for (const id of ids) {
      try {
        await adminDeleteClient(id);
      } catch (err) {
        const client = clients.find((c) => c.clientId === id);
        failures.push(`${client?.email || id} (${err.response?.data?.error || "échec"})`);
      }
    }
    setSelected(new Set());
    setBulkBusy(false);
    setBulkConfirmOpen(false);
    if (failures.length > 0) {
      setError(`Échec pour : ${failures.join(", ")}`);
    }
    load();
  }

  function copyPassword() {
    navigator.clipboard.writeText(resetResult.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Organisation" }]} />
        <h1 className="text-xl font-semibold">Organisation</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {clients.length} client{clients.length !== 1 ? "s" : ""} sur la plateforme
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-5 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Inscriptions ouvertes</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Désactive pour empêcher la création de nouveaux comptes (POST /clients) - n'affecte pas les
            comptes déjà créés.
          </p>
        </div>
        <Toggle
          on={!!registrationEnabled}
          onClick={handleToggleRegistration}
          disabled={settingsLoading || registrationEnabled === null}
          title={registrationEnabled ? "Désactiver les inscriptions" : "Activer les inscriptions"}
        />
      </div>

      {resetResult && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 space-y-2">
          <p className="text-xs text-amber-700 font-medium">
            Nouveau mot de passe pour {resetResult.email} — copie-le maintenant, il ne sera plus jamais affiché :
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block bg-white rounded p-3 text-xs break-all">{resetResult.password}</code>
            <button
              onClick={copyPassword}
              className="shrink-0 p-3 border border-amber-300 rounded-md hover:bg-amber-100 transition"
              title="Copier"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
            <button
              onClick={() => setResetResult(null)}
              className="shrink-0 text-xs text-amber-700 px-2 py-1 hover:underline"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par email ou slug..."
            className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>
        {selected.size > 0 && (
          <button
            onClick={openBulkDelete}
            disabled={bulkBusy}
            className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-md px-3 py-2 hover:bg-red-50 transition disabled:opacity-50"
          >
            <Trash2 size={14} />
            {bulkBusy ? "Suppression..." : `Supprimer la sélection (${selected.size})`}
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Chargement...</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Environnements</th>
              <th className="px-4 py-3">Créé le</th>
              <th className="px-4 py-3">Accès</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => {
              const isSelf = client.clientId === me?.clientId;
              const isBusy = busyId === client.clientId;
              return (
                <tr key={client.clientId} className={`border-t border-slate-100 ${client.suspended ? "bg-slate-50/60" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(client.clientId)}
                      onChange={() => toggleSelected(client.clientId)}
                      disabled={isSelf}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={client.suspended ? "text-slate-400 line-through decoration-slate-300" : ""}>
                        {client.email}
                      </span>
                      {client.isAdmin && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">
                          <ShieldCheck size={11} />
                          Admin
                        </span>
                      )}
                      {client.suspended && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                          <UserX size={11} />
                          Suspendu
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-xs">{client.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    {client.isAdmin ? (
                      <span className="capitalize">{client.tier}</span>
                    ) : (
                      <select
                        value={client.tier}
                        onChange={(e) => handleTierChange(client, e.target.value)}
                        disabled={isBusy}
                        className="border border-slate-200 rounded-md px-2 py-1 text-sm capitalize disabled:opacity-50"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">{client.namespaceCount}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(client.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Toggle
                      on={!client.suspended}
                      onClick={() => handleToggleSuspend(client)}
                      disabled={isSelf || isBusy}
                      title={isSelf ? "Impossible de te suspendre toi-même" : client.suspended ? "Réactiver" : "Suspendre"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleResetPassword(client)}
                        disabled={isBusy}
                        title="Réinitialiser le mot de passe"
                        className="text-slate-500 hover:bg-slate-100 rounded-md p-1.5 transition disabled:opacity-40"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError("");
                          setDeleteTarget(client);
                        }}
                        disabled={isSelf || isBusy}
                        title={isSelf ? "Impossible de te supprimer toi-même" : "Supprimer"}
                        className="text-red-600 hover:bg-red-50 rounded-md p-1.5 transition disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-slate-500 p-4">
            {clients.length === 0 ? "Aucun client sur la plateforme." : "Aucun client ne correspond à cette recherche."}
          </p>
        )}
      </div>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Supprimer le client"
        description={
          deleteTarget
            ? `Supprime définitivement ${deleteTarget.email} et ${deleteTarget.namespaceCount} environnement${deleteTarget.namespaceCount !== 1 ? "s" : ""} avec tout ce qu'ils contiennent. Cette action est irréversible.`
            : ""
        }
        confirmText={deleteTarget?.email || ""}
        confirmLabel="Email du client"
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
      />

      <ConfirmDeleteModal
        open={bulkConfirmOpen}
        title="Supprimer les clients sélectionnés"
        description={`Supprime définitivement ${selected.size} client${selected.size !== 1 ? "s" : ""} et tous leurs environnements avec tout ce qu'ils contiennent. Cette action est irréversible.`}
        confirmText={String(selected.size)}
        confirmLabel="Nombre de clients à supprimer"
        actionLabel={`Supprimer ${selected.size} client${selected.size !== 1 ? "s" : ""}`}
        loading={bulkBusy}
        error={deleteError}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </div>
  );
}
