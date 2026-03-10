From node:18-alpine AS development

#create a app directory in container
WORKDIR usr/src/app

#copy all dependencies
COPY package*.json ./

#install all dependencies
RUN npm install

#Bundle app source
COPY . .

RUN npm run build

# Producitons stages
From node:18-alpine AS production

WORKDIR usr/src/app

COPY package*.json ./

RUN npm install --only=productions

COPY . .

COPY --from=development usr/src/app/dist  ./dist


EXPOSE 3001

CMD ["node", "dist/src/main.js"]



