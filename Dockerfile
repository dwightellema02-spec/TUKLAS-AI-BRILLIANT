# Tuklas AI: one container serves the API and the built web app.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Applies the schema (safe to repeat), loads the curriculum (no accounts), creates the first admin if ADMIN_EMAIL /
# ADMIN_NAME / ADMIN_PASSWORD are set (never overwrites an existing account), then starts the server.
CMD ["sh", "-c", "if [ -n \"$DATABASE_URL\" ]; then npx prisma db push --skip-generate && npm run seed:curriculum; if [ -n \"$ADMIN_EMAIL\" ]; then npm run admin:create || true; fi; fi; npm run start"]
