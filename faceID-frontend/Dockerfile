FROM node:18

WORKDIR /app
COPY package.json package-lock.json ./
COPY . .
RUN npm install

EXPOSE 5173

CMD [ "npm","run","dev","--","--host","0.0.0.0" ]