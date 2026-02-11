# Use Node 20 LTS
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies (npm install - no lock file required)
COPY package.json ./
RUN npm install --omit=dev

# Copy app
COPY . .

# Listen on PORT (Railway sets this)
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "backend/server.js"]
