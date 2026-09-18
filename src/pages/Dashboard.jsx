import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { listNamespaces } from "../api";

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
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Environnements</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {namespaces.length} environnement{namespaces.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          to="/new"
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 transition"
        >
          <Plus size={16} />
          Nouveau
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement...</p>}

      {!loading && namespaces.length === 0 && (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <p className="text-sm text-slate-500">
            Aucun environnement pour l'instant.
          </p>
          <Link to="/new" className="text-sm text-slate-900 font-medium underline mt-2 inline-block">
            En créer un
          </Link>
        </div>
      )}

      {namespaces.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
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
