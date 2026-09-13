FROM node:20-alpine

WORKDIR /app

# Static dashboard: server.js uses only Node built-ins, so no dependency install is required.
COPY . .

ENV NODE_ENV=production
ENV PORT=4173

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4173/dashboard',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
