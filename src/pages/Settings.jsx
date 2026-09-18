import { useState } from "react";
import { KeyRound, RefreshCw, Copy, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { regenerateApiKey } from "../api";
import Breadcrumb from "../components/Breadcrumb";

export default function Settings() {
  const { me, login } = useAuth();
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleRegenerate() {
    if (
      !confirm(
        "Ça invalide immédiatement la clé actuelle - tout script ou outil qui l'utilise cessera de fonctionner. Continuer ?"
      )
    ) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const key = await regenerateApiKey();
      setNewKey(key);
      login(key); // bascule la session sur la nouvelle clé immédiatement
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de la régénération");
    } finally {
      setLoading(false);
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Paramètres" }]} />
        <h1 className="text-xl font-semibold">Paramètres</h1>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-3">Compte</h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between">
            <dt className="text-slate-500">Email</dt>
            <dd>{me?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Slug</dt>
            <dd className="font-mono">{me?.slug}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tier</dt>
            <dd className="capitalize">{me?.tier}</dd>
          </div>
          {me?.isAdmin && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Rôle</dt>
              <dd>Admin</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-1">Clé API</h2>
        <p className="text-xs text-slate-500 mb-4">
          La clé brute n'est jamais stockée - seule son empreinte l'est, donc elle ne peut être
          affichée qu'une seule fois, à sa création. Si tu l'as perdue, régénère-en une nouvelle
          (l'ancienne cesse de fonctionner immédiatement).
        </p>

        {newKey ? (
          <div className="space-y-3">
            <p className="text-xs text-amber-600 font-medium">
              Nouvelle clé générée - copie-la maintenant, elle ne sera plus jamais affichée :
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 block bg-slate-100 rounded p-3 text-xs break-all">{newKey}</code>
              <button
                onClick={copyKey}
                className="shrink-0 p-3 border border-slate-300 rounded-md hover:bg-slate-50 transition"
                title="Copier"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 rounded-md px-4 py-3">
            <div className="flex items-center gap-2.5 text-sm">
              <KeyRound size={16} className="text-slate-400" />
              <span className="font-mono">
                {me?.keyPrefix ? `${me.keyPrefix}${"•".repeat(24)}` : "aucune clé active"}
              </span>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <button
          onClick={handleRegenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 mt-4 hover:bg-slate-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Génération..." : "Régénérer la clé"}
        </button>
      </div>
    </div>
  );
}
