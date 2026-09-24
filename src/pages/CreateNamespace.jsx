import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Globe } from "lucide-react";
import { createNamespace } from "../api";
import Breadcrumb from "../components/Breadcrumb";
import { TYPE_GROUPS, DATABASE_TYPES, TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

function emptyComponent() {
  return { name: "", type: "nginx", image: "", expose: false };
}

export default function CreateNamespace() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
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

        <div>
          <div className="mb-3">
            <label className="block text-sm font-medium">Composants</label>
            <p className="text-xs text-slate-500 mt-0.5">
              Chaque composant devient un déploiement Kubernetes indépendant dans cet environnement.
            </p>
          </div>

          <div className="space-y-3">
            {components.map((c, i) => {
              const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
              const isDatabase = DATABASE_TYPES.has(c.type);
              return (
                <div
                  key={i}
                  className="relative flex gap-3 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div
                    className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ring-1 transition-colors duration-200 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex gap-2">
                      <input
                        placeholder="nom du composant"
                        value={c.name}
                        onChange={(e) => updateComponent(i, { name: e.target.value })}
                        className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                      />
                      <select
                        value={c.type}
                        onChange={(e) => updateComponent(i, { type: e.target.value })}
                        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                      >
                        {TYPE_GROUPS.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.types.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {c.type === "custom" && (
                      <input
                        placeholder="image (ex: registry.example.com/mon-app:latest)"
                        value={c.image}
                        onChange={(e) => updateComponent(i, { image: e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                      />
                    )}

                    <div className="flex items-center justify-between pt-0.5">
                      {isDatabase ? (
                        <p className="text-xs text-slate-400">Non exposable publiquement</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateComponent(i, { expose: !c.expose })}
                          className="flex items-center gap-2 group/toggle"
                        >
                          <span
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
                              c.expose ? "bg-slate-900" : "bg-slate-200"
                            }`}
                          >
                            <span
                              className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200"
                              style={{ transform: c.expose ? "translateX(18px)" : "translateX(2px)" }}
                            />
                          </span>
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-600 group-hover/toggle:text-slate-900">
                            <Globe size={12} />
                            Exposer publiquement
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeComponent(i)}
                    className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm hover:text-red-600 hover:border-red-200 transition-colors"
                    aria-label="Supprimer le composant"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addComponent}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-200"
            >
              <Plus size={16} />
              Ajouter un composant
            </button>
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
