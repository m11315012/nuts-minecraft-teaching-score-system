FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node . .

USER node

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
