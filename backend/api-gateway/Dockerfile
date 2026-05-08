FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY . .
RUN mvn -q -DskipTests -pl common -am install \
	&& mvn -q -DskipTests -pl api-gateway package org.springframework.boot:spring-boot-maven-plugin:3.3.5:repackage

FROM eclipse-temurin:17-jre
WORKDIR /opt/app
COPY --from=build /workspace/api-gateway/target/*.jar app.jar
EXPOSE 18080
ENTRYPOINT ["java","-jar","app.jar"]