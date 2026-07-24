FROM node:20-slim
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --ignore-scripts
COPY . .
RUN pnpm prisma:generate
EXPOSE 3001
CMD ["node", "src/index.js"]
