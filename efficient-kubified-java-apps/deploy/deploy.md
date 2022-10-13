# Deploy To Kubernetes

## Introduction

This section walks you through the steps needed to deploy `Joker` application to a Kubernetes cluster.

Estimated Time: 10 minutes

### Objectives


In this section, you will:
* Build a container image using Jib extension. This task is optional.
* Deploy to a Kubernetes cluster when packaging the Java application.
* Deploy to a Kubernetes cluster using a YAML file.

### Prerequisites 

This section assumes you have:
* An Oracle Cloud account with access to a Kubernetes cluster.
* All previous sections successfully completed.
* Access to a container registry that is reachable from your Kubernetes cluster.


## Task 1: Build a Container Image using Jib (Optional)

You can use Quarkus Jib Extension (`quarkus-container-image-jib`) to create and push the container image to your container registry without the need of running local docker daemon.

1. Add registry configuration properties to `src/main/resources/application.properties`, in your cloned `joker` directory:  

```properties
<copy>
# Configuration file
# key = value
#quarkus.container-image.push=true 
    
quarkus.container-image.group=ammbra
</copy>
```

> **NOTE** Change `ammbra` to your organization. If you don’t, your push will fail.

2. In order to push the container image, you have to authenticate to your container registry:

```bash
docker login
```

3. Create and push your container image when packaging the application with Maven:

| OS        | Command                                                       |
|-----------|---------------------------------------------------------------|
| macOS     | `./mvnw clean package -Dquarkus.container-image.build=true -Dquarkus.container-image.push=true`    |
| Linux     | `./mvnw clean package  -Dquarkus.container-image.build=true -Dquarkus.container-image.push=true`    |
| Windows   | `mvnw.cmd clean package  -Dquarkus.container-image.build=true  -Dquarkus.container-image.push=true`  |
{: title="List of commands to build and push a container image using Quarkus Jib extension"}

You should expect an output similar to:
```output
[INFO] [io.quarkus.container.image.jib.deployment.JibProcessor] Using base image with digest: sha256:1a2fddacdcda67494168749c7ab49243d06d8fbed34abab90566d81b94f5e1a5
[INFO] [io.quarkus.container.image.jib.deployment.JibProcessor] Container entrypoint set to [java, -Djava.util.logging.manager=org.jboss.logmanager.LogManager, -jar, quarkus-run.jar]
[INFO] [io.quarkus.container.image.jib.deployment.JibProcessor] Pushed container image ammbra/joker:1.0.0-SNAPSHOT (sha256:da2bd7068ac1de9baae267c1adb144647aff4171022a0e64de95a7a5f54494b7)

[INFO] [io.quarkus.deployment.QuarkusAugmentor] Quarkus augmentation completed in 241553ms
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  04:13 min
[INFO] Finished at: 2022-10-07T20:36:16+02:00
[INFO] ------------------------------------------------------------------------
```

## Task 2: Package your Java Application and Deploy to Kubernetes

When Kubernetes extension (`quarkus-kubernetes`) is present in the classpath, a Kubernetes deployment file is scaffolded for you during package phase.
The location of this file is `target/kubernetes/kubernetes.yml`.

1. Customize Kubernetes configuration properties from `src/main/resources/application.properties`, in your cloned `joker` directory:

```properties
<copy>
# Configuration file
# key = value
quarkus.kubernetes.namespace=default
quarkus.kubernetes.service-type=load-balancer
quarkus.kubernetes.ingress.expose=true
</copy>
```

2. Run the following command to start your Quarkus application in Dev Mode:

```bash
<copy>mvn quarkus:dev</copy>
```

3. Inspect the resources generated under `target/kubernetes/` folder.

4. Deploy to your Kubernetes cluster by running:

| OS        | Command                                                      |
|-----------|--------------------------------------------------------------|
| macOS     | `./mvnw clean package -Dquarkus.kubernetes.deploy=true`      |
| Linux     | `./mvnw clean package -Dquarkus.kubernetes.deploy=true`   |
| Windows   | `mvnw.cmd clean package -Dquarkus.kubernetes.deploy=true` |
{: title="List of commands to deploy to a Kubernetes cluster"}


## Task 3: Deploy the Application via dedicated YAML file

We provided a simple Kubernetes YAML file with everything set up, to deploy the Joker Application.

```bash
<copy>
kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app.yaml
</copy>
```

## Learn More

* [Efficient Resource Management with Kubernetes](https:dn.dev/kube-dev-practices)
* [Best Practices for Kube-Native Java Apps Workshop](https://redhat-scholars.github.io/kube-native-java-apps)

## Acknowledgements
* **Authors** - Ana-Maria Mihalceanu, Sr. Developer Advocate, Oracle | Elder Moraes, Developer Advocate, Red Hat
* **Last Updated By/Date** - Ana-Maria Mihalceanu,  September 2022
