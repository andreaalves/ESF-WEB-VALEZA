FROM node:14 AS builder

WORKDIR /app

COPY package.json ./

COPY yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

FROM nginx:latest AS server

RUN rm /etc/nginx/conf.d/default.conf 

COPY ./etc/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder ./app/build /usr/share/nginx/html
