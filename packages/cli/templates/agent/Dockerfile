# A container for this app: the starter pack a hosting platform runs per user.
#   docker build -t my-app .
#   docker run -p 3100:3100 -v my-app-data:/data -e AIMBRACE_MODEL_URL=... -e AIMBRACE_MODEL=... -e AIMBRACE_MODEL_KEY=... my-app
# The app's own data (settings, installed extensions, the ledger, tasks) lives in /data: mount a volume there to keep what the agent built.
FROM node:24-slim
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV AIMBRACE_HOME=/data AIMBRACE_HOST=0.0.0.0 AIMBRACE_PORT=3100
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3100
CMD ["node", "src/main.ts"]
