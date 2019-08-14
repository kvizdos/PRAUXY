FROM node:10
WORKDIR /usr/src/homerouter

COPY package*.json ./

RUN npm install
COPY . .

CMD ["npm", "run", "start:prod"]

EXPOSE 80