import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { adminListNamespaces } from "../api";
import { useAuth } from "../context/AuthContext";
import Breadcrumb from "../components/Breadcrumb";

// Monitoring integre directement (iframe) le dashboard Grafana unique du client
// (voir grafana.Client.CreateOrUpdateClientDashboard cote API) - Grafana reste la
// seule source de verite pour les metriques/logs, pas de reimplementation ici.
// Un seul dashboard par client (pas par namespace) : la variable $namespace du
// dashboard (menu deroulant natif Grafana, visible grace a kiosk=tv) permet de
// selectionner un ou plusieurs de ses environnements a comparer sur les memes
// graphes, et la variable $search filtre les logs par texte libre - toutes deux
// deja visibles dans l'iframe, aucune UI a reimplementer cote app pour ca.
//
// L'authentification passe par la session Grafana du navigateur (allow_embedding
// + cookie SameSite=None, voir manifest_k8s/observability/grafana.yaml) : si le
// navigateur n'est pas deja connecte a Grafana, l'iframe affiche son propre ecran
// de login - avec son propre compte (voir handlers.ensureClientGrafanaIdentity),
// jamais celui d'un autre client (dossier + permissions restreintes).
//
// Un client normal a un seul dashboard (me.grafanaDashboardUrl, voir GET /me) -
// pas de selecteur necessaire. Un admin doit choisir POUR QUEL CLIENT (pas quel
// namespace, qui vit maintenant a l'interieur du dashboard via $namespace) :
// adminListNamespaces() renvoie une ligne par namespace, dedupliquee ici par
// clientSlug puisque le dashboard est partage entre tous les namespaces d'un
// meme client.
export default function Monitoring() {
  const { isAdmin, me } = useAuth();
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isAdmin);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    adminListNamespaces()
      .then((namespaces) => {
        const byClient = new Map();
        for (const ns of namespaces) {
          if (!ns.grafanaDashboardUrl || byClient.has(ns.clientSlug)) continue;
          byClient.set(ns.clientSlug, {
            clientSlug: ns.clientSlug,
            clientEmail: ns.clientEmail,
            grafanaDashboardUrl: ns.grafanaDashboardUrl,
          });
        }
        setClients([...byClient.values()]);
      })
      .catch((err) => setError(err.response?.data?.error || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  const selectedSlug = searchParams.get("client") || "";

  // Un seul client au total : pas besoin de forcer un choix.
  useEffect(() => {
    if (isAdmin && !selectedSlug && clients.length === 1) {
      setSearchParams({ client: clients[0].clientSlug });
    }
  }, [isAdmin, clients, selectedSlug, setSearchParams]);

  const selectedClient = clients.find((cl) => cl.clientSlug === selectedSlug);

  const q = filter.trim().toLowerCase();
  const filteredClients = q
    ? clients.filter((cl) => cl.clientSlug.toLowerCase().includes(q) || cl.clientEmail?.toLowerCase().includes(q))
    : clients;

  const dashboardUrl = isAdmin ? selectedClient?.grafanaDashboardUrl : me?.grafanaDashboardUrl;
  const dashboardLabel = isAdmin ? selectedClient?.clientSlug : me?.slug;

  return (
    <div className="space-y-4 md:h-full flex flex-col">
      <div>
        <Breadcrumb items={[{ label: "Environnements", to: "/" }, { label: "Monitoring" }]} />
        <h1 className="text-xl font-semibold">Monitoring</h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Chargement...</p>}
      {isAdmin && !loading && clients.length === 0 && (
        <p className="text-sm text-slate-500">Aucun dashboard disponible pour l'instant.</p>
      )}

      {isAdmin && clients.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <select
            value={selectedSlug}
            onChange={(e) => setSearchParams(e.target.value ? { client: e.target.value } : {})}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm w-full sm:w-auto sm:min-w-[280px] bg-white"
          >
            <option value="">Sélectionner un client...</option>
            {filteredClients.map((cl) => (
              <option key={cl.clientSlug} value={cl.clientSlug}>
                {cl.clientEmail ? `${cl.clientEmail} — ${cl.clientSlug}` : cl.clientSlug}
              </option>
            ))}
          </select>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="filtrer par nom ou email client..."
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm sm:flex-1"
          />
        </div>
      )}

      {!loading && !dashboardUrl && (
        <p className="text-sm text-amber-600">
          {isAdmin ? "Sélectionne un client pour voir son dashboard." : "Pas encore de dashboard Grafana pour ton compte."}
        </p>
      )}

      {dashboardUrl && (
        <div className="bg-white shadow flex-1 min-h-[70dvh] md:min-h-[600px] overflow-hidden -mx-4 sm:mx-0 sm:rounded-xl">
          <iframe
            key={dashboardLabel}
            title={`Dashboard Grafana - ${dashboardLabel}`}
            src={`${dashboardUrl}${dashboardUrl.includes("?") ? "&" : "?"}kiosk=tv&theme=light`}
            className="w-full h-full min-h-[70dvh] md:min-h-[600px] border-0"
          />
        </div>
      )}
    </div>
  );
}
