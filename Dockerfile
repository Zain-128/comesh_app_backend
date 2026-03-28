FROM node:18-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=development /usr/src/app/dist ./dist

EXPOSE 3001

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]



