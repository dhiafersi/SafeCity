## ─── Build stage ────────────────────────────────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app

# 1) Copy only pom.xml and download deps (cached layer)
COPY pom.xml .
RUN mvn -B -DskipTests dependency:go-offline

# 2) Copy sources and build (fast when deps are cached)
COPY src ./src
RUN mvn -B -DskipTests package

## ─── Runtime stage ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
