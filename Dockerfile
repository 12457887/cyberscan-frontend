FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY package.json ./
RUN npm install --only=production --legacy-peer-deps --force

COPY .next ./.next
COPY public ./public

USER nextjs
EXPOSE 3000
CMD ["npx", "next", "start"]
