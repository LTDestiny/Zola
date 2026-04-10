FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY common ./common
COPY auth-service ./auth-service
RUN mvn -q -DskipTests -pl auth-service -am clean package

FROM eclipse-temurin:17-jre
WORKDIR /opt/app
COPY --from=build /workspace/auth-service/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]