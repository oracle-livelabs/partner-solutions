# Starter project

## Introduction

To demonstrate the concepts in this tutorial, we will use a simple Java application developed in Quarkus that exposes its own REST API and persists data in a H2 database, as well as doing a request to an external service to update content of the database.

Estimated Time: 15 minutes

### Objectives

In this section, you will:
* Clone and understand the `Joker` microservice code
* Start the `Joker` microservice in Quarkus Dev Mode
* Use the Dev Mode features to understand what is happening with the `Joker` microservice.

### Quarkus Extensions Used (Optional)
If you would like to recreate a similar setup, you can do the following:

* In a browser window, navigate to https://code.quarkus.io/?j=17
* Enrich the project to use the following Quarkus extensions:

    * `quarkus-resteasy-reactive`, `quarkus-resteasy-reactive-jackson` to create reactive JSON REST Services.
    * `quarkus-rest-client-reactive-jackson` to consume a REST endpoint with Jackson serialization support for REST Client Reactive.
    * `quarkus-smallrye-openapi` to document the exposed API.
    * `quarkus-jdbc-h2` to connect H2 database via JDBC.
    * `quarkus-hibernate-orm-panache` to simplify the code when interacting with Hibernate ORM.
    * `quarkus-smallrye-health` to monitor the application health.
    * `quarkus-container-image-jib` to generate a container image without running a Docker daemon.
    * `quarkus-kubernetes` to generate OpenShift resources from annotations.
* Click the `Generate the application` button.


## Task 1: Joker Application Overview and Code

In the following diagram you can see an overview of the application:

![Joker Application Architecture Overview](images/efficient-app.png)

When the `Joker` application starts for the first time a set of data is injected from [src/main/resources/import.sql](https://github.com/ammbra/joker/blob/c407e0b1fe03729fa1f345afd19abc290e78fef3/src/main/resources/import.sqls).

After the application is up and running, you may call the `/jokes/init` endpoint to populate the database content by consuming information from [the external service](https://v2.jokeapi.dev) and update several fields of the data already persisted in the database.

1. The code of the `Joker` application is available on [GitHub](https://github.com/ammbra/joker.git).
2. Clone the code by running the following command in a terminal window:
   ```
   git clone https://github.com/ammbra/joker.git 
   ```
3. Go to project root:
   ```
   cd joker
   ```

**NOTE** This tutorial was developed and tested with: Minikube v1.25.1  and OpenShift 4.10.

## Task 2: Start Joker Application in Dev Mode

Quarkus provides a Dev Mode which helps you during application development and it should *NEVER* be used in production.

1. In a terminal window, make sure you are in `joker` project root and you set the Java version to 17:

   ```
   $ java -version
   openjdk version "17.0.3" 2022-04-19
   OpenJDK Runtime Environment GraalVM CE 22.1.0 (build 17.0.3+7-jvmci-22.1-b06)
   OpenJDK 64-Bit Server VM GraalVM CE 22.1.0 (build 17.0.3+7-jvmci-22.1-b06, mixed mode, sharing)
   ```

2. Run the following command to start your Quarkus application in Dev Mode:

   ```
   mvn quarkus:dev
   ```
3. Unless another application uses your port 8080, you can access the `Joker` application in your favorite browser at http://localhost:8080/
4. In a browser tab copy and paste the below URL:

   ```
   http://localhost:8080/jokes
   ```
The output will be a JSON containing partial joke content.

5. Finish initialization of the application by invoking the following URL in another tab:

   ```
   http://localhost:8080/jokes/init
   ```
   
6. Go to the tab having [http://localhost:8080/jokes](http://localhost:8080/jokes) and refresh the page. Now you should see jokes in 4 languages.

## Task 3: Inspect some Dev Mode features

1. In a browser tab, go to [Dev UI](http://localhost:8080/q/dev/) and observe the state of your application configurations.
   Dev UI provides access to various actions that can change the state of your application.
Below are a few actions you can perform:
   * Change configuration values
   * Reset database content 
   * Build a container


2. When testing or running in Dev Mode Quarkus can provide you a zero config database out of the box, via a feature named [Dev Services](https://quarkus.io/guides/datasource#dev-services). 

3. The `quarkus-smallrye-openapi` extension exposes the Swagger UI when Quarkus runs in Dev Mode. 
You can interact with the API of `Joker` application by accessing the URL [http://localhost:8080/q/swagger-ui/](http://localhost:8080/q/swagger-ui/).
![Joker Application Swagger UI in Dev Mode](images/swaggerui.png)

4. The `quarkus-smallrye-health` extension exposes the Health UI when Quarkus runs in Dev Mode. You can access the Health UI of the `Joker` application via [http://localhost:8080/q/health-ui/](http://localhost:8080/q/health-ui/).
![Joker Application Health UI in Dev Mode](images/healthui.png)


Now that you got to know the application, let’s deploy it to a Kubernetes cluster.

## Learn More

* [Efficient Resource Management with Kubernetes](https:dn.dev/kube-dev-practices)
* [Best Practices for Kube-Native Java Apps Workshop](https://redhat-scholars.github.io/kube-native-java-apps)

## Acknowledgements
* **Authors** - Ana-Maria Mihalceanu, Developer Advocate, Red Hat| Elder Moraes, Developer Advocate, Red Hat
* **Last Updated By/Date** - Ana-Maria Mihalceanu,  August 2022