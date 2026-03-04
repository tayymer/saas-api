FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8080

CMD ["sh", "start.sh"]