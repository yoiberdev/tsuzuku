# El servicio de traducción. Se construye desde la raíz del repositorio porque comparte con la app
# la limpieza de la sinopsis (src/lib/sinopsis.js).
FROM node:22-alpine
WORKDIR /app
RUN echo '{ "type": "module" }' > package.json
COPY src/lib/sinopsis.js src/lib/
COPY servidor/index.mjs servidor/
ENV PORT=8080 DATOS=/datos NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "servidor/index.mjs"]
