import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Workflow, RotateCw, Square, ExternalLink, GitCommitHorizontal, GitBranch, Rocket, ScrollText, ChevronRight } from "lucide-react";
import { getComponentPipeline, retryComponentPipeline, cancelComponentPipeline, getPipelineJobLog } from "../api";
import Breadcrumb from "../components/Breadcrumb";
import { GitLabIcon } from "../components/BrandIcons";
import {
  StatusBadge,
  StatusIcon,
  statusInfo,
  isActive,
  failureReasonLabel,
  formatDuration,
  formatAgo,
  pipelineDuration,
} from "../components/pipelines/PipelineStatus";

// PipelineDetail est la page d'une pipeline GitLab d'un composant, ouverte depuis la
// section Pipelines de l'environnement ou du composant (PipelineList) : ses jobs,
// le journal d'un job, relance et annulation. L'API relaie GitLab (voir
// handlers/pipelines.go).
export default function PipelineDetail() {
  const { name, component, pipeline: pipelineId } = useParams();
  const [pipeline, setPipeline] = useState(null);
  const [error, setError] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [action, setAction] = useState("");
  const [actionError, setActionError] = useState("");

  async function load() {
    try {
      setPipeline(await getComponentPipeline(name, component, pipelineId));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    }
  }

  useEffect(() => {
    setPipeline(null);
    setSelectedJobId(null);
    load();
  }, [name, component, pipelineId]);

  // Rafraîchit vite tant que la pipeline tourne, lentement sinon.
  const active = pipeline && isActive(pipeline.status);
  useEffect(() => {
    const interval = setInterval(load, active ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [name, component, pipelineId, active]);

  // Job affiché par défaut : le premier en échec, sinon celui en cours, sinon le dernier.
  useEffect(() => {
    if (!pipeline) return;
    const jobs = pipeline.jobs || [];
    if (jobs.some((j) => j.id === selectedJobId)) return;
    const pick = jobs.find((j) => j.status === "failed") || jobs.find((j) => isActive(j.status)) || jobs[jobs.length - 1];
    setSelectedJobId(pick?.id ?? null);
  }, [pipeline]);

  async function run(kind, fn) {
    setAction(kind);
    setActionError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err.response?.data?.error || "L'action a échoué");
    } finally {
      setAction("");
    }
  }

  const breadcrumb = (
    <Breadcrumb
      items={[
        { label: "Environnements", to: "/" },
        { label: name, to: `/namespaces/${name}` },
        { label: component, to: `/namespaces/${name}/components/${component}` },
        { label: pipeline ? `Pipeline #${pipeline.iid}` : "Pipeline" },
      ]}
    />
  );

  if (error && !pipeline) {
    return (
      <div className="space-y-6">
        {breadcrumb}
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }
  if (!pipeline) return <div className="text-sm text-slate-500">Chargement...</div>;

  const duration = pipelineDuration(pipeline);
  const canRetry = ["failed", "canceled"].includes(pipeline.status);
  const canCancel = isActive(pipeline.status);

  return (
    <div className="space-y-6">
      <div>
        {breadcrumb}
        <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 bg-slate-50 text-slate-600 ring-slate-200">
              <Workflow size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold truncate">Pipeline #{pipeline.iid}</h1>
                <StatusBadge status={pipeline.status} />
                {pipeline.deployed && <DeployedTag />}
              </div>
              <p className="text-sm text-slate-700 truncate">{pipeline.commitTitle || "(commit sans titre)"}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 font-mono">
                  <GitCommitHorizontal size={12} />
                  {pipeline.sha.slice(0, 8)}
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <GitBranch size={12} />
                  {pipeline.ref}
                </span>
                {pipeline.author && <span>{pipeline.author}</span>}
                <span>{formatAgo(pipeline.createdAt)}</span>
                {duration != null && <span>durée {formatDuration(duration)}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canRetry && (
              <button
                onClick={() => run("retry", () => retryComponentPipeline(name, component, pipeline.id))}
                disabled={action !== ""}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <RotateCw size={12} className={action === "retry" ? "animate-spin" : ""} />
                Relancer les jobs en échec
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => run("cancel", () => cancelComponentPipeline(name, component, pipeline.id))}
                disabled={action !== ""}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 transition disabled:opacity-50"
              >
                <Square size={11} />
                Annuler
              </button>
            )}
            <RepoLink url={pipeline.webUrl} label="Voir dans GitLab" />
          </div>
        </div>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {error && <p className="text-xs text-amber-700">Actualisation impossible : {error}</p>}

      <div className="bg-white rounded-xl shadow p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-3">Jobs</h2>
        {pipeline.jobs?.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
            {pipeline.jobs.map((job, i) => (
              <div key={job.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-1 min-w-0">
                {i > 0 && <ChevronRight size={16} className="hidden sm:block shrink-0 text-slate-300" />}
                <button
                  onClick={() => setSelectedJobId(job.id)}
                  className={`flex-1 min-w-0 text-left rounded-lg border px-3 py-2.5 transition ${
                    selectedJobId === job.id ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <StatusIcon status={job.status} />
                    <span className="text-sm font-medium truncate">{job.name}</span>
                    <span className="ml-auto text-[11px] text-slate-400 shrink-0">
                      {job.duration != null ? formatDuration(job.duration) : statusInfo(job.status).label}
                    </span>
                  </div>
                  {job.status === "failed" && job.failureReason && (
                    <p className="text-[11px] text-red-600 mt-1 truncate">
                      {failureReasonLabel(job.failureReason)}
                      {job.allowFailure ? " (échec toléré)" : ""}
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Aucun job : la pipeline n'a rien lancé (souvent une erreur dans <span className="font-mono">.gitlab-ci.yml</span>, voir GitLab).
          </p>
        )}
      </div>

      {selectedJobId && <JobLog namespace={name} component={component} pipelineId={pipeline.id} jobId={selectedJobId} />}
    </div>
  );
}

function RepoLink({ url, label }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition"
    >
      <GitLabIcon size={13} />
      {label}
      <ExternalLink size={11} className="text-slate-400" />
    </a>
  );
}

function DeployedTag() {
  return (
    <span
      title="L'image actuelle du composant a été construite depuis ce commit"
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/10"
    >
      <Rocket size={10} strokeWidth={2.5} />
      en ligne
    </span>
  );
}

// lineClass colore les lignes marquantes d'un journal de job (texte brut, l'API
// retire les codes ANSI).
function lineClass(line) {
  if (/^\$ /.test(line)) return "text-sky-300";
  if (/\b(ERROR|FATAL|error:|failed|Failed)\b/.test(line)) return "text-red-300";
  if (/^Job succeeded/.test(line)) return "text-emerald-300";
  if (/^(WARNING|WARN)\b/.test(line)) return "text-amber-300";
  return "";
}

// JobLog affiche le journal d'un job, actualisé tant qu'il tourne.
function JobLog({ namespace, component, pipelineId, jobId }) {
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const preRef = useRef(null);
  const stickToBottom = useRef(true);

  async function load() {
    try {
      setRes(await getPipelineJobLog(namespace, component, pipelineId, jobId));
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement du journal");
    }
  }

  useEffect(() => {
    setRes(null);
    setError("");
    stickToBottom.current = true;
    load();
  }, [namespace, component, pipelineId, jobId]);

  const running = res && isActive(res.job.status);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [running, jobId]);

  // Reste en bas du journal, sauf si l'utilisateur est remonté le lire.
  useEffect(() => {
    const el = preRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [res?.log]);

  function onScroll() {
    const el = preRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ScrollText size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Journal du job {res?.job.name || ""}</h2>
            {res && <StatusBadge status={res.job.status} />}
          </div>
          <p className="text-xs text-slate-500">
            {running ? "Actualisé toutes les 3 secondes pendant l'exécution." : "Sortie complète du job."}
            {res?.truncated && " Journal long : seule la fin est affichée."}
          </p>
        </div>
        {res?.job.webUrl && <RepoLink url={res.job.webUrl} label="Ouvrir dans GitLab" />}
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <pre
        ref={preRef}
        onScroll={onScroll}
        className="bg-slate-900 text-slate-100 text-[11px] sm:text-xs rounded-md p-3 sm:p-4 overflow-auto max-h-[28rem] whitespace-pre-wrap break-all"
      >
        {!res
          ? "Chargement..."
          : res.log
            ? res.log.split("\n").map((line, i) => (
                <div key={i} className={lineClass(line)}>
                  {line || " "}
                </div>
              ))
            : "(journal vide pour l'instant)"}
      </pre>
    </div>
  );
}
