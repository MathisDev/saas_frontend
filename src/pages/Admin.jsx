import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { adminListNamespaces, deleteNamespace } from "../api";
import Breadcrumb from "../components/Breadcrumb";

export default function Admin() {
  const [namespaces, setNamespaces] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setNamespaces(await adminListNamespaces());
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

  // handleDelete supprime le namespace d'un client quelconque - le compte admin
  // n'est pas restreint aux routes /admin/* pour ça, il réutilise DELETE
  // /namespaces/:id (même route qu'un client sur ses propres environnements).
  async function handleDelete(ns) {
    if (!confirm(`Supprimer ${ns.name} (${ns.clientEmail}) ? Cette action est irréversible.`)) return;
    try {
      await deleteNamespace(ns.name);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Échec de la suppression");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Admin" }]} />
        <h1 className="text-xl font-semibold">Tous les environnements</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {namespaces.length} environnement{namespaces.length !== 1 ? "s" : ""} · tous clients confondus
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement...</p>}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Namespace</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Quota</th>
              <th className="px-4 py-3">Pods</th>
              <th className="px-4 py-3">Composants</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {namespaces.map((ns) => (
              <tr key={ns.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono">
                  <Link to={`/namespaces/${ns.name}`} className="hover:underline">
                    {ns.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {ns.clientEmail}
                  <span className="text-slate-400"> ({ns.clientSlug})</span>
                </td>
                <td className="px-4 py-3">{ns.status}</td>
                <td className="px-4 py-3">
                  {ns.cpu} / {ns.memory}
                </td>
                <td className="px-4 py-3">
                  {ns.podsReady}/{ns.podsTotal}
                </td>
                <td className="px-4 py-3">
                  {ns.components?.map((c) => c.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(ns)}
                    title="Supprimer"
                    className="text-red-600 hover:bg-red-50 rounded-md p-1.5 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && namespaces.length === 0 && (
          <p className="text-sm text-slate-500 p-4">Aucun environnement sur la plateforme.</p>
        )}
      </div>
    </div>
  );
}
