import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  login as loginRequest,
  registerClient,
  verifyRegistration,
  resendVerificationCode,
} from "../api";

export default function Login() {
  const { login, loginWithApiKey } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register" | "verify" | "key"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [code, setCode] = useState("");
  const [resendMessage, setResendMessage] = useState("");

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
      await registerClient(email.trim(), password);
      setMode("verify");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  async function submitVerify(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await verifyRegistration(email.trim(), code.trim(), password);
      setGeneratedKey(res.apiKey);
      setPendingToken(res.token);
    } catch (err) {
      setError(err.response?.data?.error || "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setResendMessage("");
    setLoading(true);
    try {
      await resendVerificationCode(email.trim());
      setResendMessage("Un nouveau code a été envoyé.");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi du code");
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

            {mode === "verify" && (
              <form onSubmit={submitVerify} className="space-y-4">
                <p className="text-sm text-slate-600">
                  Un code à 6 chiffres a été envoyé à <strong>{email.trim()}</strong>. Il expire
                  dans 15 minutes.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-center tracking-[0.5em]"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                {resendMessage && <p className="text-sm text-slate-500">{resendMessage}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "..." : "Valider le code"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={resendCode}
                  className="w-full text-xs text-slate-500 hover:text-slate-700"
                >
                  Renvoyer le code
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
