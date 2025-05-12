# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies INSIDE the container
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port Vite runs on
EXPOSE 5173

# The command to run when the container starts is defined in docker-compose.yml
CMD ["npm", "run", "dev"]