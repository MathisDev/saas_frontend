import { Link } from "react-router-dom";
import { X, ExternalLink, GitBranch, ArrowRight, Wifi } from "lucide-react";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";
import { STATUS_STYLE, formatBytes, formatRelativeTime } from "../lib/format";

// ComponentInfoPopup est la "petite page" ouverte en cliquant un nœud de
// ComponentNetworkMap : un résumé rapide (statut, pods, ressources), pas le
// détail complet (logs/shell) - le bouton "Détails" y amène via ComponentDetail.
export default function ComponentInfoPopup({ namespace, component, stats, onClose }) {
  if (!component) return null;
  const { icon: Icon, accent } = TYPE_STYLE[component.type] || TYPE_STYLE.custom;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
              <Icon size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{component.type}</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{component.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
              STATUS_STYLE[component.status] || "bg-slate-100 text-slate-600 ring-slate-600/10"
            }`}
          >
            {component.status} · {component.podsReady}/{component.podsTotal} pods
          </span>
          {component.url && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-600/10">
              <Wifi size={10} strokeWidth={2.5} />
              public
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 font-mono truncate mb-1.5">{component.image}</p>
        <p className="text-xs text-slate-400 font-mono truncate mb-4">
          {component.serviceHost}:{component.port}
        </p>

        {stats && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2.5 py-1">
              {(stats.cpuCores ?? 0).toFixed(3)} CPU
            </span>
            <span className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2.5 py-1">
              {formatBytes(stats.memoryBytes)}
            </span>
            <span
              className={`text-[11px] rounded-full px-2.5 py-1 ring-1 ${
                stats.errorCount > 0
                  ? "text-red-700 bg-red-50 ring-red-600/10 font-medium"
                  : "text-slate-500 bg-slate-50 ring-slate-200"
              }`}
            >
              {stats.errorCount} erreurs (1h)
            </span>
            <span className="text-[11px] text-slate-400 self-center">{formatRelativeTime(stats.lastLogAt)}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          {component.url && (
            <a href={component.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-600 font-medium">
              <ExternalLink size={12} />
              ouvrir
            </a>
          )}
          {component.repoUrl && (
            <a href={component.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-500">
              <GitBranch size={12} />
              dépôt GitLab
            </a>
          )}
        </div>

        <Link
          to={`/namespaces/${namespace}/components/${component.name}`}
          className="flex items-center justify-center gap-1.5 w-full bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-slate-800 transition"
        >
          Détails
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
