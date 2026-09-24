import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminListNamespaces, listNamespaces } from "../api";
import { useAuth } from "../context/AuthContext";
import Breadcrumb from "../components/Breadcrumb";

// Monitoring integre directement (iframe) le dashboard Grafana genere
// automatiquement pour chaque environnement (voir grafana.Client.
// CreateNamespaceDashboard cote API) - Grafana reste la seule source de verite
// pour les metriques/logs, pas de reimplementation ici. L'authentification passe
// par la session Grafana du navigateur (allow_embedding + cookie SameSite=None,
// voir manifest_k8s/observability/grafana.yaml) : si le navigateur n'est pas deja
// connecte a Grafana, l'iframe affiche son propre ecran de login.
//
// Accessible a tout client (pas seulement admin) - scope selon le role : un admin
// voit tous les environnements de tous les clients (adminListNamespaces, comme la
// page Admin), un client normal ne voit que les siens (listNamespaces, deja scope
// cote API par NamespaceHandler.List - jamais besoin de filtrer cote front).
export default function Monitoring() {
  const { isAdmin } = useAuth();
  const [namespaces, setNamespaces] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (isAdmin ? adminListNamespaces() : listNamespaces())
      .then(setNamespaces)
      .catch((err) => setError(err.response?.data?.error || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const selectedName = searchParams.get("env") || "";

  // Un seul environnement au total : pas besoin de forcer un choix.
  useEffect(() => {
    if (!selectedName && namespaces.length === 1) {
      setSearchParams({ env: namespaces[0].name });
    }
  }, [namespaces, selectedName, setSearchParams]);

  const selected = namespaces.find((ns) => ns.name === selectedName);

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? namespaces.filter(
        (ns) => ns.name.toLowerCase().includes(q) || ns.clientEmail?.toLowerCase().includes(q)
      )
    : namespaces;

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Monitoring" }]} />
        <h1 className="text-xl font-semibold">Monitoring</h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement...</p>}
      {!loading && namespaces.length === 0 && (
        <p className="text-sm text-slate-500">Aucun environnement pour l'instant.</p>
      )}

      {namespaces.length > 1 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedName}
            onChange={(e) => setSearchParams(e.target.value ? { env: e.target.value } : {})}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm min-w-[280px]"
          >
            <option value="">Sélectionner un environnement...</option>
            {filtered.map((ns) => (
              <option key={ns.id} value={ns.name}>
                {ns.clientEmail ? `${ns.clientEmail} — ${ns.name}` : ns.name}
              </option>
            ))}
          </select>
          {isAdmin && (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="filtrer par nom ou email client..."
              className="border border-slate-300 rounded-md px-3 py-1.5 text-sm flex-1"
            />
          )}
        </div>
      )}

      {selected && !selected.grafanaDashboardUrl && (
        <p className="text-sm text-amber-600">
          Pas encore de dashboard Grafana pour {selected.name}.
        </p>
      )}

      {selected?.grafanaDashboardUrl && (
        <div className="bg-white rounded-xl shadow flex-1 min-h-[600px] overflow-hidden">
          <iframe
            key={selected.name}
            title={`Dashboard Grafana - ${selected.name}`}
            src={`${selected.grafanaDashboardUrl}?kiosk&theme=light`}
            className="w-full h-full min-h-[600px] border-0"
          />
        </div>
      )}
    </div>
  );
}
