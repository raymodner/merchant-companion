FROM node:20-alpine
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --ignore-scripts
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev"]
