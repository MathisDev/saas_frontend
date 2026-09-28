import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { adminListNamespaces, deleteNamespace } from "../api";
import Breadcrumb from "../components/Breadcrumb";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

export default function Admin() {
  const [namespaces, setNamespaces] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
  async function handleDelete() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteNamespace(target.name);
      setTarget(null);
      load();
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Échec de la suppression");
    } finally {
      setDeleteLoading(false);
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

      <div className="md:hidden space-y-3">
        {namespaces.map((ns) => (
          <div key={ns.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/namespaces/${ns.name}`} className="font-mono font-medium text-sm block truncate">
                  {ns.name}
                </Link>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {ns.clientEmail} <span className="text-slate-400">({ns.clientSlug})</span>
                </p>
              </div>
              <button
                onClick={() => setTarget(ns)}
                aria-label="Supprimer"
                className="shrink-0 text-red-600 active:bg-red-50 rounded-md p-2 -m-1 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              <span>{ns.status}</span>
              <span>
                {ns.cpu} / {ns.memory}
              </span>
              <span>
                {ns.podsReady}/{ns.podsTotal} pods
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {ns.components?.map((c) => c.name).join(", ") || "—"}
            </p>
          </div>
        ))}
        {!loading && namespaces.length === 0 && (
          <p className="text-sm text-slate-500">Aucun environnement sur la plateforme.</p>
        )}
      </div>

      <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
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
                    onClick={() => setTarget(ns)}
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

      <ConfirmDeleteModal
        open={!!target}
        title="Supprimer l'environnement"
        description={
          target ? `Supprime définitivement ${target.name} (${target.clientEmail}) et tous ses composants. Cette action est irréversible.` : ""
        }
        confirmText={target?.name || ""}
        confirmLabel="Nom de l'environnement"
        loading={deleteLoading}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setTarget(null);
          setDeleteError("");
        }}
      />
    </div>
  );
}
