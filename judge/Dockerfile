FROM eclipse-temurin:17-jdk-jammy AS java
FROM node:24-bookworm-slim AS javascript
FROM python:3.11-slim-bookworm
COPY --from=javascript /usr/local/bin/node /usr/local/bin/node
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:$PATH"
COPY worker.py /opt/judge/worker.py
USER 65534:65534
ENTRYPOINT ["/usr/local/bin/python3", "-I", "/opt/judge/worker.py"]
