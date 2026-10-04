import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Workflow, Settings2, Play, RotateCw, Square, ExternalLink, GitCommitHorizontal, GitBranch, Rocket, ScrollText, History, ChevronRight } from "lucide-react";
import {
  listComponentPipelines,
  runComponentPipeline,
  retryComponentPipeline,
  cancelComponentPipeline,
  getPipelineJobLog,
} from "../api";
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

// PipelinesPage est la page "Pipelines" d'un composant : état des pipelines de son
// dépôt GitLab (jobs build et deploy), journal d'un job, relance et annulation, sans
// ouvrir GitLab. L'API relaie GitLab (voir handlers/pipelines.go).
export default function PipelinesPage() {
  const { name, component } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [action, setAction] = useState("");
  const [actionError, setActionError] = useState("");

  async function load() {
    try {
      const res = await listComponentPipelines(name, component);
      setData(res);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Erreur de chargement");
    }
  }

  useEffect(() => {
    setData(null);
    setSelectedId(null);
    setSelectedJobId(null);
    load();
  }, [name, component]);

  // Rafraîchit vite tant qu'une pipeline tourne, lentement sinon.
  const anyActive = data?.pipelines.some((p) => isActive(p.status));
  useEffect(() => {
    const interval = setInterval(load, anyActive ? 5000 : 20000);
    return () => clearInterval(interval);
  }, [name, component, anyActive]);

  const pipelines = data?.pipelines || [];
  const selected = pipelines.find((p) => p.id === selectedId) || pipelines[0] || null;

  // Job affiché par défaut : le premier en échec, sinon celui en cours, sinon le dernier.
  useEffect(() => {
    if (!selected) return;
    if (selected.jobs?.some((j) => j.id === selectedJobId)) return;
    const jobs = selected.jobs || [];
    const pick = jobs.find((j) => j.status === "failed") || jobs.find((j) => isActive(j.status)) || jobs[jobs.length - 1];
    setSelectedJobId(pick?.id ?? null);
  }, [selected?.id, selected?.jobs?.length]);

  async function run(kind, fn) {
    setAction(kind);
    setActionError("");
    try {
      const res = await fn();
      if (kind === "run" && res?.id) {
        setSelectedId(res.id);
        setSelectedJobId(null);
      }
      await load();
    } catch (err) {
      setActionError(err.response?.data?.error || "L'action a échoué");
    } finally {
      setAction("");
    }
  }

  const componentUrl = `/namespaces/${name}/components/${component}`;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb
          items={[
            { label: "Environnements", to: "/" },
            { label: name, to: `/namespaces/${name}` },
            { label: component, to: componentUrl },
            { label: "Pipelines" },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-1 bg-orange-50 text-orange-600 ring-orange-100">
              <Workflow size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold truncate">Pipelines {component}</h1>
              <p className="text-xs text-slate-500">Construction de l'image et déploiement à chaque push sur le dépôt</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {data?.hasRepository && (
              <button
                onClick={() => run("run", () => runComponentPipeline(name, component))}
                disabled={action !== ""}
                className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-white bg-slate-900 rounded-md px-3 py-1.5 hover:bg-slate-800 transition disabled:opacity-50"
              >
                <Play size={14} />
                {action === "run" ? "Lancement..." : "Lancer une pipeline"}
              </button>
            )}
            <Link
              to={componentUrl}
              className="shrink-0 flex items-center gap-1.5 text-sm text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50 transition"
            >
              <Settings2 size={14} />
              Configuration et logs
            </Link>
          </div>
        </div>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {error && !data ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : !data ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : !data.hasRepository ? (
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-slate-500">
            Ce composant n'a pas de dépôt GitLab (sa création a échoué) : il tourne avec son image, sans pipeline.
          </p>
        </div>
      ) : pipelines.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-sm text-slate-500 mb-3">
            Aucune pipeline pour l'instant. Chaque push sur la branche principale du dépôt en déclenche une.
          </p>
          {data.repoUrl && <RepoLink url={data.repoUrl} label="Ouvrir le dépôt GitLab" />}
        </div>
      ) : (
        <>
          {error && <p className="text-xs text-amber-700">Actualisation impossible : {error}</p>}
          <PipelineCard
            pipeline={selected}
            isLatest={selected.id === pipelines[0].id}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            busy={action}
            onRetry={() => run("retry", () => retryComponentPipeline(name, component, selected.id))}
            onCancel={() => run("cancel", () => cancelComponentPipeline(name, component, selected.id))}
          />
          {selectedJobId && <JobLog namespace={name} component={component} jobId={selectedJobId} />}
          <HistoryCard
            pipelines={pipelines}
            selectedId={selected.id}
            onSelect={(id) => {
              setSelectedId(id);
              setSelectedJobId(null);
            }}
            repoUrl={data.repoUrl}
          />
        </>
      )}
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

// PipelineCard détaille une pipeline : commit, étapes (jobs) et actions.
function PipelineCard({ pipeline, isLatest, selectedJobId, onSelectJob, busy, onRetry, onCancel }) {
  const duration = pipelineDuration(pipeline);
  const canRetry = ["failed", "canceled"].includes(pipeline.status);
  const canCancel = isActive(pipeline.status);

  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h2 className="text-sm font-semibold">
              {isLatest ? "Dernière pipeline" : "Pipeline"} #{pipeline.iid}
            </h2>
            <StatusBadge status={pipeline.status} />
            {pipeline.deployed && <DeployedTag />}
          </div>
          <p className="text-sm text-slate-800 truncate">{pipeline.commitTitle || "(commit sans titre)"}</p>
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
        <div className="flex flex-wrap gap-2">
          {canRetry && (
            <button
              onClick={onRetry}
              disabled={busy !== ""}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RotateCw size={12} className={busy === "retry" ? "animate-spin" : ""} />
              Relancer les jobs en échec
            </button>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={busy !== ""}
              className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 transition disabled:opacity-50"
            >
              <Square size={11} />
              Annuler
            </button>
          )}
          <RepoLink url={pipeline.webUrl} label="Voir dans GitLab" />
        </div>
      </div>

      {pipeline.jobs?.length > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
          {pipeline.jobs.map((job, i) => (
            <div key={job.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-1 min-w-0">
              {i > 0 && <ChevronRight size={16} className="hidden sm:block shrink-0 text-slate-300" />}
              <button
                onClick={() => onSelectJob(job.id)}
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
function JobLog({ namespace, component, jobId }) {
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");
  const preRef = useRef(null);
  const stickToBottom = useRef(true);

  async function load() {
    try {
      const r = await getPipelineJobLog(namespace, component, jobId);
      setRes(r);
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
  }, [namespace, component, jobId]);

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

// HistoryCard liste les dernières pipelines ; cliquer une ligne l'affiche en détail.
function HistoryCard({ pipelines, selectedId, onSelect, repoUrl }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <History size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold">Historique</h2>
          </div>
          <p className="text-xs text-slate-500">Les {pipelines.length} dernières pipelines du dépôt.</p>
        </div>
        {repoUrl && <RepoLink url={`${repoUrl}/-/pipelines`} label="Toutes les pipelines" />}
      </div>
      <div className="divide-y divide-slate-100 -mx-1">
        {pipelines.map((p) => {
          const duration = pipelineDuration(p);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-md transition ${
                p.id === selectedId ? "bg-slate-50" : "hover:bg-slate-50"
              }`}
            >
              <StatusIcon status={p.status} size={16} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{p.commitTitle || "(commit sans titre)"}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">
                  #{p.iid} · {p.sha.slice(0, 8)} · {p.ref}
                </p>
              </div>
              {p.deployed && (
                <span className="hidden sm:inline-flex">
                  <DeployedTag />
                </span>
              )}
              <span className="hidden sm:flex items-center gap-1">
                {(p.jobs || []).map((j) => (
                  <span key={j.id} title={`${j.name} : ${statusInfo(j.status).label.toLowerCase()}`}>
                    <StatusIcon status={j.status} size={13} />
                  </span>
                ))}
              </span>
              <span className="shrink-0 w-20 text-right text-[11px] text-slate-400">
                <span className="block">{formatAgo(p.createdAt)}</span>
                {duration != null && <span className="block">{formatDuration(duration)}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
