FROM eclipse-temurin:21-jre AS java

FROM node:22-bookworm-slim

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"
COPY --from=java /opt/java/openjdk /opt/java/openjdk

RUN npm install -g firebase-tools@15.33.0 \
    && npm cache clean --force \
    && firebase setup:emulators:firestore \
    && firebase setup:emulators:ui

WORKDIR /firebase

EXPOSE 4000 8080 9099 9150

CMD ["sh", "-c", "exec firebase emulators:start --project ${FIREBASE_PROJECT_ID} --import=/firebase/data/export --export-on-exit=/firebase/data/export"]
