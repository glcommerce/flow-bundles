FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install dependencies without workspace linking to avoid issues
RUN npm ci --omit=dev --no-workspaces && npm cache clean --force

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]
