// Cell affiche une valeur renvoyée par Postgres (toujours du texte, null pour
// NULL) : NULL distingué d'une chaîne vide, valeur longue tronquée à l'écran mais
// entière dans l'infobulle.
export function Cell({ value }) {
  if (value === null || value === undefined) {
    return <span className="italic text-slate-300">NULL</span>;
  }
  if (value === "") {
    return <span className="text-slate-300">''</span>;
  }
  const short = value.length > 120 ? `${value.slice(0, 120)}…` : value;
  return <span title={value.length > 40 ? value : undefined}>{short}</span>;
}

// ResultGrid affiche un résultat en lecture seule (éditeur SQL).
export default function ResultGrid({ columns, rows }) {
  if (!columns?.length) return null;
  return (
    <div className="overflow-auto max-h-[28rem] border border-slate-200 rounded-lg">
      <table className="min-w-full text-xs font-mono">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="text-left font-semibold text-slate-600 px-3 py-1.5 border-b border-slate-200 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-3 text-slate-400 font-sans">
                Aucune ligne.
              </td>
            </tr>
          ) : (
            rows.map((row, r) => (
              <tr key={r} className="odd:bg-white even:bg-slate-50/50">
                {row.map((v, i) => (
                  <td key={i} className="px-3 py-1 whitespace-nowrap max-w-xs truncate text-slate-700 border-b border-slate-100">
                    <Cell value={v} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
