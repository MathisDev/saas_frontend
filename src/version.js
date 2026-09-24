// APP_VERSION est injectee au build (voir Dockerfile, VITE_APP_VERSION) - un
// horodatage plutot qu'un hash git tant que les deploiements se font par
// build/push manuel avant commit (voir Layout.jsx, NamespaceDetail.jsx).
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";
