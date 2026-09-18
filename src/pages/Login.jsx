import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { registerClient } from "../api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("key"); // "key" | "register"
  const [keyInput, setKeyInput] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("free");
  const [generatedKey, setGeneratedKey] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function submitKey(e) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    login(keyInput.trim());
    navigate("/");
  }

  async function submitRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await registerClient(email.trim(), tier);
      setGeneratedKey(res.apiKey);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 className="text-xl font-semibold mb-6">SaaS Platform</h1>

        {generatedKey ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Compte créé. Voici ta clé API — elle ne sera plus jamais affichée, garde-la
              maintenant :
            </p>
            <code className="block bg-slate-100 rounded p-3 text-xs break-all">
              {generatedKey}
            </code>
            <button
              className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium"
              onClick={() => {
                login(generatedKey);
                navigate("/");
              }}
            >
              Continuer vers le dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-6 text-sm">
              <button
                className={`flex-1 py-2 rounded-md ${mode === "key" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                onClick={() => setMode("key")}
              >
                J'ai une clé
              </button>
              <button
                className={`flex-1 py-2 rounded-md ${mode === "register" ? "bg-slate-900 text-white" : "bg-slate-100"}`}
                onClick={() => setMode("register")}
              >
                Créer un compte
              </button>
            </div>

            {mode === "key" ? (
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
              </form>
            ) : (
              <form onSubmit={submitRegister} className="space-y-4">
                <input
                  type="email"
                  required
                  placeholder="email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
          </>
        )}
      </div>
    </div>
  );
}
