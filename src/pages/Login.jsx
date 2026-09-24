import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { login as loginRequest, registerClient } from "../api";

export default function Login() {
  const { login, loginWithApiKey } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register" | "key"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState("free");
  const [keyInput, setKeyInput] = useState("");

  const [generatedKey, setGeneratedKey] = useState(null);
  const [pendingToken, setPendingToken] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await loginRequest(email.trim(), password);
      login(res.token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Email ou mot de passe invalide");
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerClient(email.trim(), password, tier);
      setGeneratedKey(res.apiKey);
      setPendingToken(res.token);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  function submitKey(e) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    loginWithApiKey(keyInput.trim());
    navigate("/");
  }

  function continueAfterRegister() {
    login(pendingToken);
    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 className="text-xl font-semibold mb-6">SaaS Platform</h1>

        {generatedKey ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Compte créé. Voici ta clé API (accès programmatique, optionnel) — elle ne sera
              plus jamais affichée, garde-la si tu comptes l'utiliser :
            </p>
            <code className="block bg-slate-100 rounded p-3 text-xs break-all">
              {generatedKey}
            </code>
            <button
              className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium"
              onClick={continueAfterRegister}
            >
              Continuer vers le dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-6 text-sm">
              <button
                className={`flex-1 py-2 rounded-md ${mode === "login" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                onClick={() => setMode("login")}
              >
                Se connecter
              </button>
              <button
                className={`flex-1 py-2 rounded-md ${mode === "register" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                onClick={() => setMode("register")}
              >
                Créer un compte
              </button>
            </div>

            {mode === "login" && (
              <form onSubmit={submitLogin} className="space-y-4">
                <input
                  type="email"
                  required
                  placeholder="email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "..." : "Se connecter"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("key")}
                  className="w-full text-xs text-slate-500 hover:text-slate-700"
                >
                  Se connecter avec une clé API à la place
                </button>
              </form>
            )}

            {mode === "register" && (
              <form onSubmit={submitRegister} className="space-y-4">
                <input
                  type="email"
                  required
                  placeholder="email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mot de passe (8 caractères min.)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                </select>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "..." : "Créer le compte"}
                </button>
              </form>
            )}

            {mode === "key" && (
              <form onSubmit={submitKey} className="space-y-4">
                <input
                  type="text"
                  placeholder="sk_..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium"
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full text-xs text-slate-500 hover:text-slate-700"
                >
                  Retour à la connexion par email
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
