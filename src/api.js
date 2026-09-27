import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "https://api.saas-depoy.com/api/v1";

const api = axios.create({ baseURL });

// setCredential configure l'authentification globale de l'instance axios :
// soit un token de session (login email/mot de passe, header Authorization),
// soit une clé API brute (header X-API-Key) - jamais les deux à la fois.
// cred = null retire toute authentification (logout).
export function setCredential(cred) {
  delete api.defaults.headers.common["Authorization"];
  delete api.defaults.headers.common["X-API-Key"];
  if (!cred) return;
  if (cred.type === "token") {
    api.defaults.headers.common["Authorization"] = `Bearer ${cred.value}`;
  } else if (cred.type === "apikey") {
    api.defaults.headers.common["X-API-Key"] = cred.value;
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

export async function adminListClients() {
  const { data } = await api.get("/admin/clients");
  return data;
}

export async function adminResetClientPassword(clientId) {
  const { data } = await api.post(`/admin/clients/${clientId}/reset-password`);
  return data.password;
}

export async function adminDeleteClient(clientId) {
  await api.delete(`/admin/clients/${clientId}`);
}

export async function adminSuspendClient(clientId, suspended) {
  const { data } = await api.patch(`/admin/clients/${clientId}/suspend`, { suspended });
  return data;
}

export async function adminUpdateClientTier(clientId, tier) {
  const { data } = await api.patch(`/admin/clients/${clientId}/tier`, { tier });
  return data;
}

export async function adminGetSettings() {
  const { data } = await api.get("/admin/settings");
  return data;
}

export async function adminUpdateSettings(registrationEnabled) {
  const { data } = await api.patch("/admin/settings", { registrationEnabled });
  return data;
}

// login renvoie soit {token, ...} (connexion directe), soit
// {twoFactorRequired: true, email} si le compte a activé le 2FA (voir
// verifyTwoFactor) - à l'appelant de distinguer les deux formes.
export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

// verifyTwoFactor finalise une connexion démarrée par login() quand la
// réponse contenait twoFactorRequired - renvoie la même forme que login()
// sans 2FA ({token, ...}).
export async function verifyTwoFactor(email, code) {
  const { data } = await api.post("/auth/login/verify-2fa", { email, code });
  return data;
}

// enableTwoFactor/disableTwoFactor activent ou désactivent le 2FA sur la
// connexion email/mot de passe (voir Paramètres) - le mot de passe actuel est
// exigé dans les deux cas.
export async function enableTwoFactor(password) {
  await api.post("/me/2fa/enable", { password });
}

export async function disableTwoFactor(password) {
  await api.post("/me/2fa/disable", { password });
}

export async function registerClient(email, password) {
  const { data } = await api.post("/clients", { email, password });
  return data;
}

// verifyRegistration finalise une inscription démarrée par registerClient : le
// mot de passe est resoumis ici (jamais stocké côté API en attendant le code,
// voir handlers.ClientHandler.VerifyRegistration) - renvoie la même forme que
// l'ancien registerClient direct (clé API + token de session).
export async function verifyRegistration(email, code, password) {
  const { data } = await api.post("/clients/verify", { email, code, password });
  return data;
}

export async function resendVerificationCode(email) {
  const { data } = await api.post("/clients/resend-code", { email });
  return data;
}

export async function setPassword(password) {
  await api.post("/me/password", { password });
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

export async function addComponent(name, component) {
  const { data } = await api.post(`/namespaces/${name}/components`, component);
  return data;
}

// updateComponent reconfigure un composant déjà provisionné - patch ne contient
// que les champs à changer (image/port/replicas/env/expose), les autres gardent
// leur valeur actuelle côté API. Seule façon de reconfigurer un composant : plus
// de dépôt de manifests Kubernetes accessible au client (voir API.md).
export async function updateComponent(name, componentName, patch) {
  const { data } = await api.patch(`/namespaces/${name}/components/${componentName}`, patch);
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

// getAIManifest récupère le manifest Markdown auto-suffisant (auth, endpoints,
// conventions, namespaces actuels) pensé pour être collé dans le contexte d'un
// assistant IA - jamais de secret dedans (clé API/mot de passe), voir
// handlers/manifest.go côté API.
export async function getAIManifest() {
  const { data } = await api.get("/me/ai-manifest", { responseType: "text" });
  return data;
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
