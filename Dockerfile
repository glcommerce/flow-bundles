# Flow-Bundles Dockerfile - Built at 2026-04-26T12:00:00Z
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
