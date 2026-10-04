import { CircleCheck, CircleX, LoaderCircle, Clock, Ban, SkipForward, Hand, CircleDashed } from "lucide-react";

// Statuts GitLab des pipelines et des jobs (voir handlers/pipelines.go côté API),
// partagés entre la page Pipelines, la page d'un composant et la liste des composants.
const STATUS = {
  success: { label: "Réussie", icon: CircleCheck, badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/10", fg: "text-emerald-600" },
  failed: { label: "Échouée", icon: CircleX, badge: "bg-red-50 text-red-700 ring-red-600/10", fg: "text-red-600" },
  running: { label: "En cours", icon: LoaderCircle, badge: "bg-sky-50 text-sky-700 ring-sky-600/10", fg: "text-sky-600", spin: true },
  pending: { label: "En attente", icon: Clock, badge: "bg-amber-50 text-amber-700 ring-amber-600/10", fg: "text-amber-600" },
  canceled: { label: "Annulée", icon: Ban, badge: "bg-slate-100 text-slate-600 ring-slate-600/10", fg: "text-slate-500" },
  skipped: { label: "Ignorée", icon: SkipForward, badge: "bg-slate-100 text-slate-600 ring-slate-600/10", fg: "text-slate-400" },
  manual: { label: "Manuelle", icon: Hand, badge: "bg-violet-50 text-violet-700 ring-violet-600/10", fg: "text-violet-600" },
  unknown: { label: "Inconnu", icon: CircleDashed, badge: "bg-slate-100 text-slate-600 ring-slate-600/10", fg: "text-slate-400" },
};

// Statuts intermédiaires de GitLab ramenés aux familles ci-dessus.
const ALIASES = {
  created: "pending",
  waiting_for_resource: "pending",
  preparing: "pending",
  scheduled: "pending",
  waiting_for_callback: "pending",
  canceling: "canceled",
};

export function statusInfo(status) {
  return STATUS[ALIASES[status] || status] || STATUS.unknown;
}

// isActive : la pipeline ou le job peut encore changer d'état.
export function isActive(status) {
  return ["running", "pending", "created", "waiting_for_resource", "preparing", "scheduled", "waiting_for_callback", "canceling"].includes(status);
}

const FAILURE_REASONS = {
  script_failure: "le script du job a échoué",
  runner_system_failure: "erreur du runner",
  stuck_or_timeout_failure: "aucun runner disponible ou délai dépassé",
  job_execution_timeout: "durée maximale dépassée",
  api_failure: "erreur de l'API GitLab",
  unmet_prerequisites: "prérequis manquants",
  scheduler_failure: "erreur de planification",
  data_integrity_failure: "erreur d'intégrité",
  runner_unsupported: "runner incompatible",
  archived_failure: "job archivé",
  unknown_failure: "erreur inconnue",
};

export function failureReasonLabel(reason) {
  return FAILURE_REASONS[reason] || reason;
}

export function formatDuration(seconds) {
  if (seconds == null) return "";
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

export function formatAgo(iso) {
  if (!iso) return "";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

// pipelineDuration : du début du premier job à la fin du dernier (ou à maintenant
// s'il tourne encore).
export function pipelineDuration(pipeline) {
  const starts = (pipeline.jobs || []).map((j) => j.startedAt).filter(Boolean).map((d) => new Date(d).getTime());
  if (starts.length === 0) return null;
  const ends = (pipeline.jobs || []).map((j) => (j.finishedAt ? new Date(j.finishedAt).getTime() : isActive(j.status) ? Date.now() : null));
  const end = Math.max(...ends.filter((e) => e != null), Math.min(...starts));
  return (end - Math.min(...starts)) / 1000;
}

export function StatusIcon({ status, size = 14, className = "" }) {
  const { icon: Icon, fg, spin } = statusInfo(status);
  return <Icon size={size} className={`shrink-0 ${fg} ${spin ? "animate-spin" : ""} ${className}`} />;
}

export function StatusBadge({ status, label, compact = false }) {
  const info = statusInfo(status);
  const Icon = info.icon;
  return (
    <span
      title={compact ? `Pipeline : ${info.label.toLowerCase()}` : undefined}
      className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-medium rounded-full ring-1 ring-inset ${
        compact ? "p-1 sm:px-2 sm:py-0.5" : "px-2 py-0.5"
      } ${info.badge}`}
    >
      <Icon size={11} strokeWidth={2.5} className={info.spin ? "animate-spin" : ""} />
      <span className={compact ? "hidden sm:inline" : ""}>{label || info.label}</span>
    </span>
  );
}
