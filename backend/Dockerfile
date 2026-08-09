FROM node:20-slim
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --ignore-scripts --shamefully-hoist
COPY . .
RUN pnpm prisma:generate
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma:deploy && node src/index.js"]
