FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY common ./common
COPY file-service ./file-service
RUN mvn -q -DskipTests -pl file-service -am clean package

FROM eclipse-temurin:17-jre
WORKDIR /opt/app
COPY --from=build /workspace/file-service/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]