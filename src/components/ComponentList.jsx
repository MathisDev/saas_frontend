import { useNavigate } from "react-router-dom";
import { ChevronRight, Wifi, Globe, ExternalLink } from "lucide-react";
import { GitLabIcon } from "./BrandIcons";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";
import { STATUS_STYLE, formatBytes, formatRelativeTime } from "../lib/format";
import { StatusBadge, statusInfo } from "./pipelines/PipelineStatus";

// ComponentList est la vue des composants sur la page environnement (voir
// NamespaceDetail). Chaque carte porte tout le résumé du composant (statut, image,
// adresse interne, ressources, liens, dernière pipeline) ; cliquer la carte ouvre
// directement sa page de détail (ComponentDetail).
// stats (facultatif) : résumé d'observabilité par nom de composant
// (GET /namespaces/:id/components/summary) ; pipelines (facultatif) : dernière
// pipeline GitLab par nom de composant.
export default function ComponentList({ namespace, components, stats = {}, pipelines = {} }) {
  const navigate = useNavigate();

  if (components.length === 0) {
    return <p className="text-sm text-slate-500">Aucun composant pour l'instant.</p>;
  }

  return (
    <div className="space-y-2">
      {components.map((c) => {
        const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
        const s = stats[c.name];
        const detailUrl = `/namespaces/${namespace}/components/${c.name}`;
        return (
          <div
            key={c.name}
            role="link"
            tabIndex={0}
            onClick={() => navigate(detailUrl)}
            onKeyDown={(e) => e.key === "Enter" && navigate(detailUrl)}
            className="group cursor-pointer p-3 sm:p-4 rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm active:bg-slate-50"
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
                <Icon size={18} strokeWidth={2} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{c.type}</span>
                  <span className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                    {pipelines[c.name] && <StatusBadge status={pipelines[c.name].status} label={`Pipeline : ${statusInfo(pipelines[c.name].status).label.toLowerCase()}`} />}
                    {c.url && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-600/10">
                        <Wifi size={10} strokeWidth={2.5} />
                        public
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
                        STATUS_STYLE[c.status] || "bg-slate-100 text-slate-600 ring-slate-600/10"
                      }`}
                    >
                      {c.status} · {c.podsReady}/{c.podsTotal} pods
                    </span>
                  </span>
                </div>

                <p className="text-xs text-slate-500 font-mono truncate mt-1">{c.image}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">
                  {c.serviceHost ? `${c.serviceHost}:${c.port}` : `:${c.port}`}
                </p>

                {(s || c.url || c.repoUrl) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {s && (
                      <>
                        <Chip>{(s.cpuCores ?? 0).toFixed(3)} CPU</Chip>
                        <Chip>{formatBytes(s.memoryBytes)}</Chip>
                        <span
                          className={`text-[11px] rounded-full px-2 py-0.5 ring-1 ${
                            s.errorCount > 0 ? "text-red-700 bg-red-50 ring-red-600/10 font-medium" : "text-slate-500 bg-slate-50 ring-slate-200"
                          }`}
                        >
                          {s.errorCount} erreurs (1h)
                        </span>
                        <span className="text-[11px] text-slate-400 mr-1">{formatRelativeTime(s.lastLogAt)}</span>
                      </>
                    )}
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ouvrir l'URL publique dans un nouvel onglet"
                        className="inline-flex items-center gap-1 min-w-0 max-w-full text-[11px] font-medium text-sky-700 bg-sky-50 ring-1 ring-sky-100 rounded-md px-2 py-0.5 hover:bg-sky-100 transition"
                      >
                        <Globe size={11} className="shrink-0" />
                        <span className="truncate">URL publique</span>
                        <ExternalLink size={10} className="shrink-0 opacity-60" />
                      </a>
                    )}
                    {c.repoUrl && (
                      <a
                        href={c.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Ouvrir le dépôt GitLab dans un nouvel onglet"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2 py-0.5 hover:bg-slate-50 transition"
                      >
                        <GitLabIcon size={11} />
                        Dépôt GitLab
                        <ExternalLink size={10} className="text-slate-400" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <ChevronRight size={16} className="shrink-0 self-center text-slate-300 group-hover:text-slate-500 transition" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ children }) {
  return <span className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200 rounded-full px-2 py-0.5">{children}</span>;
}

