# Init node on Alpine
FROM node:alpine as build

# Setup workspace
WORKDIR /

COPY / .

# Install dependencies
RUN npm install --save

# Run
CMD [ "node", "index.js" ]