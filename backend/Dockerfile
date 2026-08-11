FROM node:26-slim
ENV CI=true
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --ignore-scripts --shamefully-hoist
COPY . .
RUN pnpm prisma:generate
EXPOSE 3001
CMD ["node", "src/index.js"]
