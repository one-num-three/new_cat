FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && addgroup -S app && adduser -S app -G app
COPY v2 ./v2
COPY shared ./shared
USER app
ENV NODE_ENV=production PORT=4000 HOST=0.0.0.0
EXPOSE 4000
CMD ["node", "v2/server.js"]
