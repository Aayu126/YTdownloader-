# Use a base image with Node.js
FROM node:18-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 4000

# Define the command to run your app
CMD ["node", "server.js"]