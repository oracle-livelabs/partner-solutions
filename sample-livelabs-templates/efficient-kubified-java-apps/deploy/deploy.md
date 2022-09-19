# Deploy To Kubernetes

## Introduction

This section walks you through the steps needed to deploy `Joker` application to a Kubernetes cluster.

Estimated Time: 10 minutes

### Objectives


In this section, you will:
* Build a container image using Docker extension. This task is optional.
* Deploy to a Kubernetes cluster when packaging the Java application.
* Deploy to a Kubernetes cluster using a YAML file.

### Prerequisites 

This section assumes you have:
* An Oracle Cloud account with access to a Kubernetes cluster.
* All previous sections successfully completed.
* Access to a container registry that is reachable from your Kubernetes cluster.


## Task 1: Build a Container Image using Docker (Optional)

You can use Quarkus Docker Extension (`quarkus-container-image-docker`) to create and push the container image to your container registry. When packaging the application, this extension uses the generated Docker files that are located under `src/main/Docker/`.

1. Add registry configuration properties to `src/main/resources/application.properties`, in your cloned `joker` directory:  

```
<copy>
# Configuration file
# key = value
#quarkus.container-image.push=true 
    
quarkus.container-image.group=myrepo
</copy>
```

> **NOTE** Change `myrepo` to your organization. If you don’t, your push will fail.

2. In order to push the container image, you have to authenticate to your container registry:

```shell
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
INFO] [io.quarkus.deployment.util.ExecUtil] 36b85501f1e0: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] 1cdca92b725b: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] 6271a138c8f4: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] fa32d4b709c4: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] 69c6d244b79a: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] 60609ec85f86: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] f2c4302f03b8: Preparing
[INFO] [io.quarkus.deployment.util.ExecUtil] f2c4302f03b8: Waiting
[INFO] [io.quarkus.deployment.util.ExecUtil] 60609ec85f86: Waiting
[INFO] [io.quarkus.deployment.util.ExecUtil] 1cdca92b725b: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] 6271a138c8f4: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] 36b85501f1e0: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] 60609ec85f86: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] fa32d4b709c4: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] f2c4302f03b8: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] 69c6d244b79a: Pushed
[INFO] [io.quarkus.deployment.util.ExecUtil] 1.0.0-SNAPSHOT: digest: sha256:16b5b49994f3a8b253284de049bd08accd672c68b1e27edd4c718fae08da1b5c size: 1787
[INFO] [io.quarkus.container.image.docker.deployment.DockerProcessor] Successfully pushed docker image ammbra/joker:1.0.0-SNAPSHOT
[INFO] [io.quarkus.deployment.QuarkusAugmentor] Quarkus augmentation completed in 78872ms
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:39 min
[INFO] Finished at: 2022-09-19T10:55:15+02:00
[INFO] ------------------------------------------------------------------------
```

## Task 2: Package your Java Application and Deploy to Kubernetes

When Kubernetes extension (`quarkus-kubernetes`) is present in the classpath, a Kubernetes deployment file is scaffolded for you during package phase.
The location of this file is `target/kubernetes/kubernetes.yml`.

1. Customize Kubernetes configuration properties from `src/main/resources/application.properties`, in your cloned `joker` directory:

```
<copy>
# Configuration file
# key = value
quarkus.kubernetes.service-type=load-balancer
quarkus.kubernetes.ingress.expose=true
</copy>
```

2. Deploy to your Kubernetes cluster by running:

| OS        | Command                                                      |
|-----------|--------------------------------------------------------------|
| macOS     | `./mvnw clean package -Dquarkus.kubernetes.deploy=true`      |
| Linux     | `./mvnw clean package -Dquarkus.kubernetes.deploy=true`   |
| Windows   | `mvnw.cmd clean package -Dquarkus.kubernetes.deploy=true` |
{: title="List of commands to deploy to a Kubernetes cluster"}


## Task 3: Deploy the Application via dedicated YAML file

We provided a simple Kubernetes YAML file with everything set up, to deploy the Joker Application.

```
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
