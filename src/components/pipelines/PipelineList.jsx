import { useState } from "react";
import { Link } from "react-router-dom";
import { Workflow, ChevronRight, Rocket } from "lucide-react";
import { StatusIcon, statusInfo, formatAgo, formatDuration, pipelineDuration } from "./PipelineStatus";

// PipelineList est la section "Pipelines" de la page d'un environnement (toutes ses
// pipelines, avec leur composant) et de la page d'un composant (les siennes). Une
// ligne mène au détail de la pipeline (PipelineDetail). Les données viennent du
// parent, qui les rafraîchit avec le reste de sa page.
export default function PipelineList({ namespace, pipelines, showComponent = false, description, action, emptyText, initial = 5 }) {
  const [expanded, setExpanded] = useState(false);

  if (pipelines == null) return null;
  const visible = expanded ? pipelines : pipelines.slice(0, initial);

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Workflow size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Pipelines</h2>
          </div>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>

      {pipelines.length === 0 ? (
        <p className="text-xs text-slate-400 mt-2">{emptyText || "Aucune pipeline pour l'instant."}</p>
      ) : (
        <>
          <div className="divide-y divide-slate-100 -mx-2">
            {visible.map((p) => {
              const duration = pipelineDuration(p);
              const component = p.component;
              return (
                <Link
                  key={`${component}-${p.id}`}
                  to={`/namespaces/${namespace}/components/${component}/pipelines/${p.id}`}
                  className="group flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 transition"
                >
                  <span title={statusInfo(p.status).label}>
                    <StatusIcon status={p.status} size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 truncate">
                      {showComponent && <span className="font-medium text-slate-900">{component} · </span>}
                      {p.commitTitle || "(commit sans titre)"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      #{p.iid} · {p.sha.slice(0, 8)} · {p.ref}
                    </p>
                  </div>
                  {p.deployed && (
                    <span title="Image actuellement en ligne" className="hidden sm:inline-flex text-indigo-500">
                      <Rocket size={13} />
                    </span>
                  )}
                  <span className="hidden sm:flex items-center gap-1">
                    {(p.jobs || []).map((j) => (
                      <span key={j.id} title={`${j.name} : ${statusInfo(j.status).label.toLowerCase()}`}>
                        <StatusIcon status={j.status} size={12} />
                      </span>
                    ))}
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-slate-400 leading-tight">
                    <span className="block">{formatAgo(p.createdAt)}</span>
                    {duration != null && <span className="block">{formatDuration(duration)}</span>}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-slate-300 group-hover:text-slate-500" />
                </Link>
              );
            })}
          </div>
          {pipelines.length > initial && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700"
            >
              {expanded ? "Réduire" : `Afficher tout (${pipelines.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
