import { Wifi, Layers } from "lucide-react";
import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

// ComponentNetworkMap est la seule vue des composants sur la page environnement
// (voir NamespaceDetail) : cliquer un nœud ouvre ComponentInfoPopup plutôt que
// d'afficher une grille de cartes à côté. Disposition en étoile autour d'un hub
// central représentant l'environnement (pas un composant, jamais cliquable) -
// pas un graphe de dépendances : le réseau k8s est plat au sein d'un namespace
// (n'importe quel composant joint n'importe quel autre via serviceHost:port),
// donc chaque trait signifie juste "appartient à cet environnement", jamais
// "dépend de". Un maillage complet entre composants (O(n²) traits) induirait
// à tort une chaîne de dépendances en plus de devenir illisible au-delà de 4-5
// composants - le hub garde ça a O(n) traits, lisible a n'importe quelle taille.
export default function ComponentNetworkMap({ components, selected, onSelect }) {
  if (components.length === 0) {
    return <p className="text-sm text-slate-500">Aucun composant pour l'instant.</p>;
  }

  const radius = components.length === 1 ? 0 : 38;
  const positions = components.map((_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / components.length;
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });

  return (
    <div>
      <p className="text-xs text-slate-500 mb-5">
        Réseau plat au sein de l'environnement : chaque composant peut joindre les autres via
        l'adresse et le port indiqués sur son nœud.
      </p>
      <div className="relative w-full aspect-square max-w-xl mx-auto rounded-3xl bg-gradient-to-b from-slate-50/80 to-white ring-1 ring-slate-100">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <linearGradient id="cnm-edge" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>
          {positions.map((pos, i) => (
            <line
              key={i}
              x1={50}
              y1={50}
              x2={pos.x}
              y2={pos.y}
              stroke="url(#cnm-edge)"
              strokeWidth="0.6"
              strokeDasharray="2.5 2.5"
            />
          ))}
        </svg>

        {components.length > 1 && (
          <div
            className="absolute flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 shadow-md ring-4 ring-white -translate-x-1/2 -translate-y-1/2"
            style={{ left: "50%", top: "50%" }}
            title="Cet environnement"
          >
            <Layers size={18} strokeWidth={2} className="text-white" />
          </div>
        )}

        {components.map((c, i) => {
          const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
          const pos = positions[i];
          const isSelected = selected === c.name;
          return (
            <button
              key={c.name}
              onClick={() => onSelect?.(c)}
              className="absolute flex flex-col items-center gap-2.5 w-32 -translate-x-1/2 -translate-y-1/2 text-center group"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="relative">
                {c.url && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-sky-600 text-white shadow ring-2 ring-white">
                    <Wifi size={10} strokeWidth={2.5} />
                  </span>
                )}
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center ring-1 shadow-sm transition-all duration-200 ease-out group-hover:shadow-lg group-hover:-translate-y-1 ${ACCENT_BG[accent]} ${
                    isSelected ? "ring-2 ring-slate-900 shadow-lg -translate-y-1" : ACCENT_RING[accent]
                  }`}
                >
                  <Icon size={26} strokeWidth={1.75} />
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                <p className="text-[11px] font-mono font-medium text-slate-400 truncate">:{c.port}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
