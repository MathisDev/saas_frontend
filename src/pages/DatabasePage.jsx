import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Database, Settings2 } from "lucide-react";
import { getNamespace } from "../api";
import Breadcrumb from "../components/Breadcrumb";
import DatabaseManager from "../components/database/DatabaseManager";

// DatabasePage est la page "Base de données" d'un composant postgres : données
// (tables, éditeur SQL) et sauvegardes sur un seul écran.
export default function DatabasePage() {
  const { name, component } = useParams();
  const [comp, setComp] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setComp(null);
    setError("");
    getNamespace(name)
      .then((ns) => {
        if (cancelled) return;
        const c = ns.components.find((x) => x.name === component);
        if (c) setComp(c);
        else setError("Composant introuvable.");
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.error || "Erreur de chargement");
      });
    return () => {
      cancelled = true;
    };
  }, [name, component]);

  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!comp) return <div className="text-sm text-slate-500">Chargement...</div>;
  if (comp.type !== "postgres") {
    return <div className="text-sm text-slate-500">Ce composant n'est pas une base PostgreSQL.</div>;
  }

  const componentUrl = `/namespaces/${name}/components/${comp.name}`;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "Environnements", to: "/" },
            { label: name, to: `/namespaces/${name}` },
            { label: comp.name, to: componentUrl },
            { label: "Base de données" },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 bg-indigo-50 text-indigo-600 ring-indigo-100">
              <Database size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">Base de données {comp.name}</h1>
              <p className="text-xs text-slate-500">Tables, éditeur SQL et sauvegardes</p>
            </div>
          </div>
          <Link
            to={componentUrl}
            className="shrink-0 flex items-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
          >
            <Settings2 size={14} />
            Configuration et logs
          </Link>
        </div>
      </div>

      <DatabaseManager namespace={name} component={component} />
    </div>
  );
}
