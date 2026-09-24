import { Globe, Server, Code2, Terminal, Braces, Database, Box } from "lucide-react";

// Miroir front de saas_api/handlers/component_types.go (componentTypes /
// IsDatabase) - dupliqué volontairement (pas d'endpoint qui expose cette table
// aujourd'hui), à garder synchronisé si un type est ajouté/retiré côté API.
// Icone + accent (teinte douce, coherente avec la palette slate/blanc du reste de
// l'app) par famille de runtime : les types d'une meme famille partagent la meme
// image de base tant qu'aucun vrai build n'a ete pousse, donc la meme icone/couleur
// a du sens. Aucune signification technique au choix de couleur, juste distinguer
// les composants au premier coup d'oeil.
export const TYPE_GROUPS = [
  { label: "Frontend", types: ["nginx", "react", "vue", "angular", "svelte"], icon: Globe, accent: "sky" },
  { label: "Full-stack / Node", types: ["nextjs", "nuxt", "sveltekit", "nodejs", "express", "nestjs"], icon: Server, accent: "emerald" },
  { label: "Python", types: ["python", "django", "fastapi"], icon: Code2, accent: "amber" },
  { label: "Backend compilé", types: ["springboot", "aspnet", "go"], icon: Terminal, accent: "violet" },
  { label: "PHP", types: ["laravel", "symfony"], icon: Braces, accent: "rose" },
  { label: "Base de données", types: ["postgres", "mysql", "mssql", "mongodb", "redis"], icon: Database, accent: "indigo" },
  { label: "Autre", types: ["custom"], icon: Box, accent: "slate" },
];

export const COMPONENT_TYPES = TYPE_GROUPS.flatMap((g) => g.types);

export const DATABASE_TYPES = new Set(["postgres", "mysql", "mssql", "mongodb", "redis"]);

export const TYPE_STYLE = Object.fromEntries(
  TYPE_GROUPS.flatMap(({ types, icon, accent }) => types.map((t) => [t, { icon, accent }]))
);

// Classes Tailwind par teinte - listees en dur (et non composees dynamiquement,
// ex. `bg-${accent}-50`) car Tailwind scanne le code source pour generer le CSS :
// une classe construite par interpolation n'existe dans aucun fichier source et
// serait purgee du build final.
export const ACCENT_RING = {
  sky: "ring-sky-100",
  emerald: "ring-emerald-100",
  amber: "ring-amber-100",
  violet: "ring-violet-100",
  rose: "ring-rose-100",
  indigo: "ring-indigo-100",
  slate: "ring-slate-200",
};
export const ACCENT_BG = {
  sky: "bg-sky-50 text-sky-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
  indigo: "bg-indigo-50 text-indigo-600",
  slate: "bg-slate-100 text-slate-600",
};
