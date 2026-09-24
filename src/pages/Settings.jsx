import { useState } from "react";
import { KeyRound, RefreshCw, Copy, Check, Lock, Bot, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { regenerateApiKey, setPassword as setPasswordRequest, getAIManifest } from "../api";
import Breadcrumb from "../components/Breadcrumb";

export default function Settings() {
  const { me, credentialType, loginWithApiKey } = useAuth();
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [manifest, setManifest] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestError, setManifestError] = useState("");
  const [manifestCopied, setManifestCopied] = useState(false);

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
      // Si la session en cours s'authentifie via cette clé (mode "J'ai une clé"),
      // il faut basculer dessus tout de suite - l'ancienne devient invalide.
      if (credentialType === "apikey") {
        loginWithApiKey(key);
      }
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

  async function handleGenerateManifest() {
    setManifestLoading(true);
    setManifestError("");
    try {
      setManifest(await getAIManifest());
    } catch (err) {
      setManifestError(err.response?.data?.error || "Erreur lors de la génération");
    } finally {
      setManifestLoading(false);
    }
  }

  function copyManifest() {
    navigator.clipboard.writeText(manifest);
    setManifestCopied(true);
    setTimeout(() => setManifestCopied(false), 2000);
  }

  function downloadManifest() {
    const blob = new Blob([manifest], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manifest-ia-${me?.slug || "compte"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError("");
    setPasswordSaved(false);
    try {
      await setPasswordRequest(newPassword);
      setPasswordSaved(true);
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.response?.data?.error || "Erreur lors de la mise à jour");
    } finally {
      setPasswordLoading(false);
    }
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
        <h2 className="text-sm font-semibold mb-1">Mot de passe</h2>
        <p className="text-xs text-slate-500 mb-4">
          Utilisé pour te connecter avec ton email sur la page de connexion, à la place de la
          clé API.
        </p>

        <form onSubmit={handleSetPassword} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            placeholder="Nouveau mot de passe (8 caractères min.)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-green-600">Mot de passe mis à jour.</p>}
          <button
            type="submit"
            disabled={passwordLoading}
            className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
          >
            <Lock size={14} />
            {passwordLoading ? "..." : "Mettre à jour"}
          </button>
        </form>
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

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-sm font-semibold mb-1">Manifest pour IA</h2>
        <p className="text-xs text-slate-500 mb-4">
          Génère un document Markdown auto-suffisant (authentification, endpoints, conventions de
          nommage, quotas par défaut) plus l'état actuel de tes namespaces - à coller dans le
          contexte d'un assistant IA pour qu'il puisse développer ou scripter contre cette
          plateforme sans avoir à la redécouvrir. Ne contient jamais ta clé API ni ton mot de
          passe.
        </p>

        {manifestError && <p className="text-sm text-red-600 mb-3">{manifestError}</p>}

        {manifest && (
          <div className="space-y-3 mb-4">
            <pre className="bg-slate-900 text-slate-100 rounded-md p-3 text-xs max-h-64 overflow-y-auto whitespace-pre-wrap">
              {manifest}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={copyManifest}
                className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
              >
                {manifestCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {manifestCopied ? "Copié" : "Copier"}
              </button>
              <button
                onClick={downloadManifest}
                className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
              >
                <Download size={14} />
                Télécharger (.md)
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerateManifest}
          disabled={manifestLoading}
          className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
        >
          <Bot size={14} className={manifestLoading ? "animate-pulse" : ""} />
          {manifestLoading ? "Génération..." : manifest ? "Régénérer le manifest" : "Générer le manifest"}
        </button>
      </div>
    </div>
  );
}
