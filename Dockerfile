FROM node:22-alpine

WORKDIR /app

# Copy package definition
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Generate Prisma client and build frontend assets
RUN npm run build

# Expose server port
EXPOSE 3000

# Run Prisma schema push on container start and launch server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx server.ts"]
