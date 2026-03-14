FROM node:24-alpine
ARG NODE_ENV=test
ENV NODE_ENV $NODE_ENV

WORKDIR /app

ADD ./vre-panel/package.json ./
RUN npm install

ADD ./vre-panel .

RUN chmod +x -R .

EXPOSE 3000
CMD ["npm", "run", "dev"]



