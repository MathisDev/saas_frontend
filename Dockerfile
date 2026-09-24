# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# URL de l'API a la construction (build-time, pas runtime - Vite l'inline dans le
# bundle statique). Changer necessite un rebuild de l'image.
ARG VITE_API_BASE_URL=https://api.saas-depoy.com/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Identifie le build affiche (footer sidebar, page environnement) - horodatage
# plutot qu'un hash git : les deploiements se font aujourd'hui par build/push
# manuel avant tout commit, un hash git figerait "version" sur un etat perime.
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
