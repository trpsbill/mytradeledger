FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install


RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npm", "start"]