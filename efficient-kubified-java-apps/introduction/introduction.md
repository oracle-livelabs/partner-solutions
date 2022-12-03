![RedHat Company Logo](./images/redhat-company-logo.png =800x*)

**Community Contributed Workshop**
* **Authors:** *Elder Moraes, Developer Advocate, Red Hat & Ana-Maria Mihalceanu, Sr. Developer Advocate, Oracle*

# Introduction

## About this Workshop

This workshop will explore best practices and valuable settings to manage application resources in a Kubernetes cluster. Since the load of cluster usage may increase rapidly due to traffic load and the number of applications deployed, it’s better to set up resource quotas to keep the workloads running smoothly.

Estimated Time: 2 hours 00 minutes 


### Objectives

In this workshop, you will:
* Deploy to Kubernetes a Java application using Quarkus framework and its extensions.
* Observe resource quotas to efficiently run the kubified application.
* Observe  and adjust memory and CPU consumed over time by a containerized Java application.
* Create integration tests to validate Kubernetes/OpenShift resources prior to their actual deployment.

### Prerequisites

This lab assumes you have a set of tools. Please look into the table below and have those installed.

| **Tool**                                                                    | **macOS**                                                                                              | **Fedora**                                                                                            | **windows**                                                                                                                           |
|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `Git`                                                                       | [Download](https://git-scm.com/download/mac)                                                           | [Download](https://git-scm.com/download/linux)                                                        | [Download](https://git-scm.com/download/win)                                                                                          |
| **Java 17**                                                                 | `brew tap AdoptOpenJDK/openjdk && brew cask install adoptopenjdk17`                                    | `dnf install java-17-openjdk.x86_64`                                                                  | [Windows](https://adoptopenjdk.net) (Make sure you set the `JAVA_HOME` environment variable and add `%JAVA_HOME%\bin` to your `PATH`) |
| `Docker`                                                                    | [Docker for Mac](https://docs.docker.com/docker-for-mac/install)                                       | `dnf install docker`                                                                                  | [Docker for Windows](https://docs.docker.com/docker-for-windows/install)                                                              |
| `VirtualBox`                                                                | [Download](https://download.virtualbox.org/virtualbox/6.1.6/VirtualBox-6.1.6-137129-OSX.dmg)           | [Download](https://www.virtualbox.org/wiki/Linux_Downloads)                                           | [Download](https://download.virtualbox.org/virtualbox/6.1.6/VirtualBox-6.1.6-137129-Win.exe)                                          |
| [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube) v1.25.1 | [Download](https://github.com/kubernetes/minikube/releases/download/v1.25.1/minikube-darwin-amd64)     | [Download](https://github.com/kubernetes/minikube/releases/download/v1.25.1/minikube-linux-amd64)     | [Download](https://github.com/kubernetes/minikube/releases/download/v1.25.1/minikube-windows-amd64.exe)                               |
| `kubectl v1.23.1`                                                           | [Download](https://storage.googleapis.com/kubernetes-release/release/v1.23.1/bin/darwin/amd64/kubectl) | [Download](https://storage.googleapis.com/kubernetes-release/release/v1.23.1/bin/linux/amd64/kubectl) | [Download](https://storage.googleapis.com/kubernetes-release/release/v1.23.1/bin/windows/amd64/kubectl.exe)                           |
| [stern](https://github.com/wercker/stern)                                   | `brew install stern`                                                                                   | [Download](https://github.com/wercker/stern/releases/download/1.11.0/stern_linux_amd64)               | [Download](https://github.com/wercker/stern/releases/download/1.11.0/stern_windows_amd64.exe)                                         |
| `Apache Maven 3.6.3`                                                        | [Download](https://archive.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.tar.gz) | [Download](https://archive.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.zip)   | [Download](https://archive.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.tar.gz)                                |
| [hey](https://github.com/rakyll/hey)                                        | `brew install hey`                                                                                     | [Download](https://storage.googleapis.com/jblabs/dist/hey_linux_v0.1.2)                               | [Download](https://storage.googleapis.com/jblabs/dist/hey_win_v0.1.2.exe)                                                             |
{: title="List of tools needed to complete this tutorial"}



## Learn More

* [Efficient Resource Management with Kubernetes](https:dn.dev/kube-dev-practices)
* [Best Practices for Kube-Native Java Apps Workshop](https://redhat-scholars.github.io/kube-native-java-apps)

## Acknowledgements
* **Authors** - Ana-Maria Mihalceanu, Sr. Developer Advocate, Oracle| Elder Moraes, Developer Advocate, Red Hat
* **Last Updated By/Date** - Ana-Maria Mihalceanu,  September 2022
