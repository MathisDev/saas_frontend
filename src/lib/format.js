// formatBytes/formatRelativeTime sont partagés entre la popup de composant
// (ComponentInfoPopup) et sa page de détail (ComponentDetail) - mêmes stats
// (voir handlers/dto.go ComponentSummaryResponse) affichées aux deux endroits.
export function formatBytes(bytes) {
  if (!bytes) return "0 Mo";
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} Go` : `${mb.toFixed(0)} Mo`;
}

export function formatRelativeTime(iso) {
  if (!iso) return "aucune activité récente";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h`;
}

export const STATUS_STYLE = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  Provisioning: "bg-amber-50 text-amber-700 ring-amber-600/10",
  Failed: "bg-red-50 text-red-700 ring-red-600/10",
};
