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
# scripts/start-production.sh: checks the settings, applies the database migrations (never `db push`), loads the curriculum (no accounts),
# creates the first admin if ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD are set (never overwrites an account), then runs the server.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "scripts/start-production.sh"]
