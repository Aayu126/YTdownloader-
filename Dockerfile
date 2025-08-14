# Use a base image with a more recent, stable Node.js version to fix compatibility issues
FROM node:20-alpine

# Install ffmpeg, which is needed to merge video and audio streams
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