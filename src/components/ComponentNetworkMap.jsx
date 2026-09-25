import { TYPE_STYLE, ACCENT_BG, ACCENT_RING } from "../lib/componentTypes";

// ComponentNetworkMap montre l'adresse interne (serviceHost:port, voir
// handlers/dto.go ComponentResponse.ServiceHost) de chaque composant du
// namespace. Le reseau k8s est plat au sein d'un namespace : n'importe quel
// composant peut en joindre un autre via cette adresse - les traits ne
// representent donc pas une dependance reelle/declaree (aucune n'est trackee
// cote API, voir le commentaire sur ComponentNode dans NamespaceDetail), juste
// la joignabilite potentielle. Le port affiche sur chaque noeud est celui a
// utiliser pour LE joindre, lui, depuis n'importe quel autre composant.
export default function ComponentNetworkMap({ components }) {
  if (components.length === 0) {
    return <p className="text-sm text-slate-500">Aucun composant pour l'instant.</p>;
  }

  const radius = components.length === 1 ? 0 : 34;
  const positions = components.map((_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / components.length;
    return {
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });

  const edges = [];
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      edges.push([i, j]);
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-4">
        Réseau plat au sein du namespace : chaque composant peut joindre les autres via
        l'adresse et le port indiqués sur son nœud.
      </p>
      <div className="relative w-full aspect-square max-w-md mx-auto">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible">
          {edges.map(([i, j]) => (
            <line
              key={`${i}-${j}`}
              x1={positions[i].x}
              y1={positions[i].y}
              x2={positions[j].x}
              y2={positions[j].y}
              stroke="#e2e8f0"
              strokeWidth="0.5"
            />
          ))}
        </svg>

        {components.map((c, i) => {
          const { icon: Icon, accent } = TYPE_STYLE[c.type] || TYPE_STYLE.custom;
          const pos = positions[i];
          return (
            <div
              key={c.name}
              className="absolute flex flex-col items-center gap-1 w-28 -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ring-1 bg-white shadow-sm ${ACCENT_BG[accent]} ${ACCENT_RING[accent]}`}
              >
                <Icon size={16} strokeWidth={2} />
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate w-full">{c.name}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate w-full" title={c.serviceHost}>
                {c.serviceHost}
              </p>
              <span className="text-[10px] font-mono font-medium text-slate-700 bg-slate-100 rounded-full px-2 py-0.5">
                :{c.port}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
