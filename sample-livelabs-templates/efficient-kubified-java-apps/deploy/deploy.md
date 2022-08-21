# Deploy To Kubernetes

## Introduction

This section walks you through the steps needed to deploy `Joker` application to a Kubernetes cluster.

Estimated Time: 10 minutes

### Objectives


In this section, you will:
* Build a container image using Jib. This task is optional.
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
    # Configuration file
    # key = value
    #quarkus.container-image.push=true 
    
    quarkus.container-image.registry=quay.io
    quarkus.container-image.group=myrepo
    quarkus.container-image.name=greeting-app
    quarkus.container-image.tag=1.0-SNAPSHOT
```

> **NOTE** Change `quay.io` to your container registry and `myrepo` to your organization. If you don’t, your push will fail.

2. In order to push the container image, you have to authenticate to your container registry:

```shell
docker login quay.io
```

3. Create and push your container image when packaging the application with Maven:

| OS        | Command                                                       |
|-----------|---------------------------------------------------------------|
| macOS     | `./mvnw clean package -Dquarkus.container-image.push=true`    |
| Linux     | `./mvnw clean package -Dquarkus.container-image.push=true`    |
| Windows   | `mvnw.cmd clean package -Dquarkus.container-image.push=true`  |
{: title="List of commands to build and push a container image using Quarkus Jib extension"}

You should expect an output similar to:
```output
[INFO] [io.quarkus.container.image.jib.deployment.JibProcessor] Using base image with digest: sha256:1a2fddacdcda67494168749c7ab49243d06d8fbed34abab90566d81b94f5e1a5
[INFO] [io.quarkus.container.image.jib.deployment.JibProcessor] Container entrypoint set to [java, -Djava.util.logging.manager=org.jboss.logmanager.LogManager, -jar, quarkus-run.jar]
[INFO] [io.quarkus.container.image.jib.deployment.JibProcessor] Pushed container image quay.io/rhdevelopers/joker:1.0.0-SNAPSHOT (sha256:c0b74e651b9d18ca81db0b409570ceb103256cae7846783fb4883d9171821ad2)

[INFO] [io.quarkus.deployment.QuarkusAugmentor] Quarkus augmentation completed in 51109ms
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  56.437 s
[INFO] Finished at: 2022-08-21T11:34:04+02:00
[INFO] ------------------------------------------------------------------------
```

## Task 2: Package your Java Application and Deploy to Kubernetes

When Kubernetes extension (`quarkus-kubernetes`) is present in the classpath, a Kubernetes deployment file is scaffolded for you during package phase.
The location of this file is `target/kubernetes/kubernetes.yml`.

1. Customize Kubernetes configuration properties from `src/main/resources/application.properties`, in your cloned `joker` directory:

```properties
    # Configuration file
    # key = value
    quarkus.kubernetes.ingress.expose=true
```

2. Deploy to your Kubernetes cluster by running:

| OS        | Command                                                      |
|-----------|--------------------------------------------------------------|
| macOS     | `./mvnw clean package -Dquarkus.kubernetes.deploy=true`      |
| Linux     | `./mvnw clean package -Dquarkus.kubernetes.deploy=true`   |
| Windows   | `mvnw.cmd clean package -Dquarkus.kubernetes.deploy=true` |
{: title="List of commands to deploy to a Kubernetes cluster"}


## Task 3: Deploy the Application via dedicated YAML file

We also provided a simple Kubernetes YAML file with everything set up, to deploy the Joker Application.

```shell
kubectl apply -f https://raw.githubusercontent.com/ammbra/joker/master/kubefiles/deploy-joker-app.yaml
```

## Learn More

* [Efficient Resource Management with Kubernetes](https:dn.dev/kube-dev-practices)
* [Best Practices for Kube-Native Java Apps Workshop](https://redhat-scholars.github.io/kube-native-java-apps)

## Acknowledgements
* **Authors** - Ana-Maria Mihalceanu, Developer Advocate, Red Hat| Elder Moraes, Developer Advocate, Red Hat
* **Last Updated By/Date** - Ana-Maria Mihalceanu,  August 2022
