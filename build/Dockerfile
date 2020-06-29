FROM node:10.18.0-alpine3.11

RUN apk update && apk add --no-cache hunspell python g++ make

WORKDIR /usr/src/app
ENV PORT=80
ENV NODE_ENV=production

COPY package*.json ./
COPY . .

RUN npm install
RUN npm install db --save

EXPOSE 80

CMD [ "npm", "run", "start" ]
