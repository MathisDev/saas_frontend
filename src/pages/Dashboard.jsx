import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { listNamespaces } from "../api";
import { useAuth } from "../context/AuthContext";

const STATUS_STYLES = {
  Active: "bg-green-100 text-green-700",
  Provisioning: "bg-amber-100 text-amber-700",
  Failed: "bg-red-100 text-red-700",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
        STATUS_STYLES[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Un compte free n'a droit qu'à un seul namespace (voir NamespaceHandler.Create
  // côté API) - passer en pro pour en créer plus.
  const atFreeNamespaceLimit = me?.tier !== "pro" && namespaces.length >= 1;

  async function load() {
    try {
      setNamespaces(await listNamespaces());
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Environnements</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {namespaces.length} environnement{namespaces.length !== 1 ? "s" : ""}
          </p>
        </div>
        {atFreeNamespaceLimit ? (
          <span
            title="Un compte free est limité à un seul environnement - passe en pro pour en créer plus."
            className="flex items-center gap-1.5 bg-slate-100 text-slate-400 text-sm font-medium px-4 py-2 rounded-md cursor-not-allowed"
          >
            <Plus size={16} />
            Nouveau
          </span>
        ) : (
          <Link
            to="/new"
            className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 transition"
          >
            <Plus size={16} />
            Nouveau
          </Link>
        )}
      </div>

      {atFreeNamespaceLimit && (
        <p className="text-xs text-slate-400">
          Compte free limité à un seul environnement - passe en pro pour en créer plus.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement...</p>}

      {!loading && namespaces.length === 0 && (
        <div className="bg-white rounded-xl shadow p-8 md:p-10 text-center">
          <p className="text-sm text-slate-500">
            Aucun environnement pour l'instant.
          </p>
          <Link to="/new" className="text-sm text-slate-900 font-medium underline mt-2 inline-block">
            En créer un
          </Link>
        </div>
      )}

      {namespaces.length > 0 && (
        <div className="md:hidden space-y-3">
          {namespaces.map((ns) => (
            <Link
              key={ns.id}
              to={`/namespaces/${ns.name}`}
              className="block bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/70 p-4 active:scale-[0.99] active:bg-slate-50 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900 truncate">{ns.name}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusPill status={ns.status} />
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                <span className="capitalize">{ns.tier}</span>
                <span>
                  {ns.cpu} CPU / {ns.memory}
                </span>
                <span>
                  {ns.podsReady}/{ns.podsTotal} pods
                </span>
              </div>
              {ns.components?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {ns.components.map((c) => (
                    <span key={c.name} className="text-xs bg-slate-100 rounded px-2 py-0.5">
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {namespaces.length > 0 && (
        <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Quota</th>
                <th className="px-4 py-3 font-medium">Pods</th>
                <th className="px-4 py-3 font-medium">Composants</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {namespaces.map((ns) => (
                <tr
                  key={ns.id}
                  onClick={() => navigate(`/namespaces/${ns.name}`)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <Link to={`/namespaces/${ns.name}`} className="font-medium text-slate-900">
                      {ns.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={ns.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{ns.tier}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {ns.cpu} CPU / {ns.memory}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {ns.podsReady}/{ns.podsTotal}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {ns.components?.map((c) => (
                        <span key={c.name} className="text-xs bg-slate-100 rounded px-2 py-0.5">
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
