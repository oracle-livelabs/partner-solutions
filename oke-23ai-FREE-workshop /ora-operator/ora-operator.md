# Install the Oracle Database Operator for Kubernetes (OraOperator)

## Introduction

In this lab will learn how to deploy the Oracle Database Operator for Kubernetes into an existing OKE cluster.

Estimated Time: 10 minutes

The **Oracle Database Operator for Kubernetes** extends the Kubernetes API with custom resources and controllers for automating and simplifying Oracle Database lifecycle management.

### Objectives

In this lab, you will:

* Install Oracle Database Operator for Kubernetes
* Review the Oracle Database Operator

### Prerequisites

This lab assumes you have:

* An OKE cluster that meets the Portworx prerequisites
* A working knowledge of Kubernetes
* OCI CLI configured
* kubectl installed

## Task 1: Install Oracle Database Operator for Kubernetes (OraOperator)

1. Install Certificate Manager

   The Database Operator uses webhooks for validating user input before persisting it in etcd. Webhooks require TLS certificates that are generated and managed by a certificate manager.

   Install the certificate manager using the below:

    ```bash
    <copy>kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.4/cert-manager.yaml </copy>
    ```

2. Pull Oracle Database Operator for Kubernetes

   Pull the latest Oracle Database Operator for Kubernetes from the Oracle GitHub Repo using:

     ```bash
     <copy>git clone https://github.com/oracle/oracle-database-operator.git</copy>
     ```

3. Create Role Bindings for Access Management

   OraOperator can be deployed to operate in a cluster or namespace, and to monitor one or many namespaces.

   Grant **serviceaccount:oracle-database-operator-system:default** service account cluster wide.

     ```bash
     <copy>kubectl apply -f rbac/cluster-role-binding.yaml</copy>
     ```

4. Install Oracle Database Operator for Kubernetes

   Install Oracle Database Operator for Kubernetes using **kubectl apply -f < filename.yaml >**

     ```bash
     <copy>kubectl apply -f oracle-database-operator.yaml</copy>
     ```

5. For Storage Management

   For automatic storage expansion of block volumes apply the **rbac/storage-class-rbac.yaml** file

    ```bash
    <copy>kubectl apply -f rbac/storage-class-rbac.yaml</copy>
    ```

6. For Custom Scripts

  For automatic execution of custom scripts post database setup or startup apply the **rbac/persistent-volume-rbac.yaml** file

    ```bash
    <copy>kubectl apply -f rbac/persistent-volume-rbac.yaml</copy>
    ```

## Task 2: Review status of Oracle Database Operator for Kubernetes

1. Confirm status of Database Operator

   Use **kubectl get all** to see the Kubernetes pods, services, deployments and replicasets within the **oracle-database-operator-system** namespace.

    ```bash
    <copy>kubectl get all -n oracle-database-operator-system</copy>
    ```

   Example Output:

    ```text
    NAME                                                               READY   STATUS    RESTARTS   AGE
    pod/oracle-database-operator-controller-manager-56c588cc6d-f2pg2   1/1     Running   0          4m40s
    pod/oracle-database-operator-controller-manager-56c588cc6d-g4wmv   1/1     Running   0          4m40s
    pod/oracle-database-operator-controller-manager-56c588cc6d-swwzh   1/1     Running   0          20h

    NAME                                                                  TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
    service/oracle-database-operator-controller-manager-metrics-service   ClusterIP   10.96.84.31    <none>        8443/TCP   20h
    service/oracle-database-operator-webhook-service                      ClusterIP   10.96.74.164   <none>        443/TCP    20h

    NAME                                                          READY   UP-TO-DATE   AVAILABLE   AGE
    deployment.apps/oracle-database-operator-controller-manager   3/3     3            3           20h

    NAME                                                                     DESIRED   CURRENT   READY   AGE
    replicaset.apps/oracle-database-operator-controller-manager-56c588cc6d   3         3         3       20h
    ```

2. Describe Database Operator for Kubernetes

   Use **kubectl describe deployments** to review details.

    ```bash
    <copy> kubectl describe deployments/oracle-database-operator-controller-manager -n oracle-database-operator-system </copy>
    ````

## Learn More

* [Container Engine for Kubernetes](https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm)
* [Oracle Database Operator for Kubernetes (OraOperator)](https://github.com/oracle/oracle-database-operator)
* [Oracle Database 23ai Free](https://www.oracle.com/database/free/)
* [Kubernetes Documentation](https://kubernetes.io/docs/home/)
* [Portworx Documentation](https://docs.portworx.com/portworx-enterprise/)
* [ronekins.com](https://ronekins.com/)

## Acknowledgements

* **Author** - [Ron Ekins](https://ace.oracle.com/apex/ace/profile/ronekins), Oracle ACE Director, Director of Field Solutions Architecture for EMEA & LATAM @ Pure Storage
* **Last Updated By/Date** - Ron Ekins, May 2024
