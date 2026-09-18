import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createNamespace } from "../api";
import Breadcrumb from "../components/Breadcrumb";

const COMPONENT_TYPES = ["nginx", "python", "postgres", "custom"];

function emptyComponent() {
  return { name: "", type: "nginx", image: "", expose: false };
}

export default function CreateNamespace() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tier, setTier] = useState("free");
  const [cpu, setCpu] = useState("2");
  const [memory, setMemory] = useState("4Gi");
  const [components, setComponents] = useState([emptyComponent()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateComponent(i, patch) {
    setComponents((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addComponent() {
    setComponents((cs) => [...cs, emptyComponent()]);
  }

  function removeComponent(i) {
    setComponents((cs) => cs.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        name,
        tier,
        resourceQuotas: { cpu, memory },
        components: components
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            type: c.type,
            expose: c.expose,
            ...(c.type === "custom" && c.image ? { image: c.image } : {}),
          })),
      };
      const res = await createNamespace(payload);
      navigate(`/namespaces/${res.name}`);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Nouveau" }]} />
      <h1 className="text-xl font-semibold mb-6">Nouvel environnement</h1>

      <form onSubmit={submit} className="space-y-6 bg-white rounded-xl shadow p-6">
        <div>
          <label className="block text-sm font-medium mb-1">Nom</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="production"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="free">free</option>
              <option value="pro">pro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CPU</label>
            <input
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mémoire</label>
            <input
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium">Composants</label>
            <button type="button" onClick={addComponent} className="text-sm text-slate-600">
              + Ajouter
            </button>
          </div>

          <div className="space-y-3">
            {components.map((c, i) => (
              <div key={i} className="flex gap-2 items-start bg-slate-50 rounded-md p-3">
                <input
                  placeholder="nom"
                  value={c.name}
                  onChange={(e) => updateComponent(i, { name: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
                <select
                  value={c.type}
                  onChange={(e) => updateComponent(i, { type: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                >
                  {COMPONENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {c.type === "custom" && (
                  <input
                    placeholder="image"
                    value={c.image}
                    onChange={(e) => updateComponent(i, { image: e.target.value })}
                    className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  />
                )}
                <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap px-1">
                  <input
                    type="checkbox"
                    disabled={c.type === "postgres"}
                    checked={c.expose}
                    onChange={(e) => updateComponent(i, { expose: e.target.checked })}
                  />
                  public
                </label>
                <button
                  type="button"
                  onClick={() => removeComponent(i)}
                  className="text-slate-400 text-sm px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
          >
            {loading ? "Création..." : "Créer"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-sm text-slate-500 px-4 py-2"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
