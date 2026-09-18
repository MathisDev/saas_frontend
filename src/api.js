import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "https://api.saas-depoy.com/api/v1";

const api = axios.create({ baseURL });

export function setApiKey(key) {
  if (key) {
    api.defaults.headers.common["X-API-Key"] = key;
  } else {
    delete api.defaults.headers.common["X-API-Key"];
  }
}

export async function getMe() {
  const { data } = await api.get("/me");
  return data;
}

export async function adminListNamespaces() {
  const { data } = await api.get("/admin/namespaces");
  return data;
}

export async function registerClient(email, tier) {
  const { data } = await api.post("/clients", { email, tier });
  return data;
}

export async function listNamespaces() {
  const { data } = await api.get("/namespaces");
  return data;
}

export async function getNamespace(name) {
  const { data } = await api.get(`/namespaces/${name}`);
  return data;
}

export async function createNamespace(payload) {
  const { data } = await api.post("/namespaces", payload);
  return data;
}

export async function deleteNamespace(name) {
  await api.delete(`/namespaces/${name}`);
}

export async function updateQuotas(name, quotas) {
  const { data } = await api.patch(`/namespaces/${name}/quotas`, quotas);
  return data;
}

export async function listPods(name) {
  const { data } = await api.get(`/namespaces/${name}/pods`);
  return data;
}

export async function getPodLogs(name, pod, tail = 200) {
  const { data } = await api.get(`/namespaces/${name}/pods/${pod}/logs`, {
    params: { tail },
  });
  return data;
}

export async function getPod(name, pod) {
  const { data } = await api.get(`/namespaces/${name}/pods/${pod}`);
  return data;
}

export async function execPod(name, pod, command) {
  const { data } = await api.post(`/namespaces/${name}/pods/${pod}/exec`, { command });
  return data;
}

export async function createShellTicket(name, pod) {
  const { data } = await api.post(`/namespaces/${name}/pods/${pod}/shell-ticket`);
  return data.ticket;
}

export function getShellSocketURL(name, pod, ticket) {
  const wsBase = baseURL.replace(/^http/, "ws");
  return `${wsBase}/namespaces/${name}/pods/${pod}/shell?ticket=${encodeURIComponent(ticket)}`;
}

export async function searchLogs(name, { pod, q, size } = {}) {
  const { data } = await api.get(`/namespaces/${name}/logs`, { params: { pod, q, size } });
  return data;
}

export async function getMetrics(name) {
  const { data } = await api.get(`/namespaces/${name}/metrics`);
  return data;
}

export async function getComponentsSummary(name) {
  const { data } = await api.get(`/namespaces/${name}/components/summary`);
  return data;
}

export async function regenerateApiKey() {
  const { data } = await api.post("/me/api-key/regenerate");
  return data.apiKey;
}

// runConsoleRequest exécute une requête arbitraire (utilisée par la Console) avec
// la clé API déjà authentifiée - jamais de throw sur une erreur HTTP : la console
// doit pouvoir afficher un 4xx/5xx comme un résultat normal, pas planter.
export async function runConsoleRequest(method, path, body) {
  const start = performance.now();
  try {
    const res = await api.request({
      method,
      url: path,
      data: body,
      validateStatus: () => true,
    });
    return {
      status: res.status,
      data: res.data,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      status: 0,
      data: { error: err.message },
      durationMs: Math.round(performance.now() - start),
    };
  }
}

export default api;
