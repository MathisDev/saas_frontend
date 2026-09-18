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

RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
