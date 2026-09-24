import { useEffect, useState } from "react";
import { KeyRound, Trash2, Copy, Check, ShieldCheck } from "lucide-react";
import { adminListClients, adminResetClientPassword, adminDeleteClient } from "../api";
import { useAuth } from "../context/AuthContext";
import Breadcrumb from "../components/Breadcrumb";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

export default function Organisation() {
  const { me } = useAuth();
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setClients(await adminListClients());
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function handleDelete(client) {
    if (
      !confirm(
        `Supprimer définitivement ${client.email} ? Ça supprime aussi ${client.namespaceCount} environnement${client.namespaceCount !== 1 ? "s" : ""} et tout ce qu'ils contiennent. Cette action est irréversible.`
      )
    )
      return;
    setBusyId(client.clientId);
    setError("");
    try {
      await adminDeleteClient(client.clientId);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de la suppression");
    } finally {
      setBusyId(null);
    }
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
      {loading && <p className="text-sm text-slate-500">Chargement...</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Environnements</th>
              <th className="px-4 py-3">Créé le</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const isSelf = client.clientId === me?.clientId;
              return (
                <tr key={client.clientId} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {client.email}
                      {client.isAdmin && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 rounded-full px-2 py-0.5">
                          <ShieldCheck size={11} />
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-xs">{client.slug}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{client.tier}</td>
                  <td className="px-4 py-3">{client.namespaceCount}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(client.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleResetPassword(client)}
                        disabled={busyId === client.clientId}
                        title="Réinitialiser le mot de passe"
                        className="text-slate-500 hover:bg-slate-100 rounded-md p-1.5 transition disabled:opacity-40"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
                        disabled={isSelf || busyId === client.clientId}
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
        {!loading && clients.length === 0 && (
          <p className="text-sm text-slate-500 p-4">Aucun client sur la plateforme.</p>
        )}
      </div>
    </div>
  );
}
