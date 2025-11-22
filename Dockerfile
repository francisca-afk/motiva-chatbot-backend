FROM node:18

WORKDIR /app

COPY package*.json ./
COPY node_modules ./node_modules

COPY . .

ENV NODE_ENV=production

EXPOSE 5002

CMD ["node", "app.js"]