import { ChevronRight, Wifi } from "lucide-react";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";
import { STATUS_STYLE } from "../lib/format";

// ComponentList est la seule vue des composants sur la page environnement (voir
// NamespaceDetail) : une carte réseau a été tentée (ComponentNetworkMap) mais
// abandonnée - sans configuration réseau réelle à représenter (le réseau k8s
// est plat au sein d'un namespace, aucune dépendance entre composants n'est
// trackée côté API), le "plan" ne montrait rien de plus qu'une liste avec un
// habillage inutile. Cliquer une ligne ouvre ComponentInfoPopup, comme avant.
export default function ComponentList({ components, onSelect }) {
  if (components.length === 0) {
    return <p className="text-sm text-slate-500">Aucun composant pour l'instant.</p>;
  }

  return (
    <div className="space-y-2">
      {components.map((c) => {
        const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
        return (
          <button
            key={c.name}
            onClick={() => onSelect?.(c)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}>
              <Icon size={18} strokeWidth={2} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
              <p className="text-xs text-slate-400 font-mono truncate">
                {c.type} · :{c.port}
              </p>
            </div>

            {c.url && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-600/10">
                <Wifi size={10} strokeWidth={2.5} />
                public
              </span>
            )}

            <span
              className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset ${
                STATUS_STYLE[c.status] || "bg-slate-100 text-slate-600 ring-slate-600/10"
              }`}
            >
              {c.status} · {c.podsReady}/{c.podsTotal}
            </span>

            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </button>
        );
      })}
    </div>
  );
}
