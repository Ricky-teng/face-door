FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
