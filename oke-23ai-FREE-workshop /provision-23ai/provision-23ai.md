# Provision containerized Oracle Database 23ai Free

## Introduction

In this lab will learn how to deploy a containerized Oracle Database 23ai Free into an existing OKE cluster.

Estimated Time: 10 minutes

**Oracle Database 23ai Free** offers the ability to experience Oracle Database, which businesses throughout the world rely on for their mission-critical workloads. The resource limits for Oracle Database Free are up to 2 CPUs for foreground processes, 2 GB of RAM and 12 GB of user data on disk.

### Objectives

In this lab, you will:

* Configure OKE Cluster for Oracle Database 23ai Free
* Provision containerized Oracle Database 23ai Free
* Review containerized Oracle Database 23ai Free
* Connect to containerized Oracle Database 23ai Free

### Prerequisites

This lab assumes you have:

* An OKE cluster that meets the Portworx prerequisites
* A working knowledge of Kubernetes
* OCI CLI configured
* kubectl installed

## Task 1: Configure OKE Cluster for Oracle Database 23ai Free

1. List Kubernetes Storage Classes (sc)

   OCI provides two Kubernetes storage classes *oci*, and *oci-bv*, the oci block volume (*oci-bv*) is now the **default** and is used by the CSI volume plugin.

   The *oci* class is considered *legacy* and is only used by the *FlexVolume* plugin.

   Use **kubectl get sc** to list all available Kubernetes Storage Classes

   If you completed Lab 2 you will see also see the available Portworx Storage Classes

    ```bash
    <copy>kubectl get sc </copy>
    ```

    Example Output:

    ```text
    NAME               PROVISIONER                       RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
    oci                oracle.com/oci                    Delete          Immediate              false                  53m
    oci-bv (default)   blockvolume.csi.oraclecloud.com   Delete          WaitForFirstConsumer   true                   53m
    ```

2. Create Kubernetes Namespace

   Create dedicated Kubernetes namespace

    ```bash
    <copy>kubectl create ns oracle23ai</copy>
    ```

3. Create Kubernetes Database Secret

   Copy the below and paste into an editor, save as **free-admin-secret.yaml**

    ```bash
    <copy>
    ## Oracle Database Free Admin password secret
    apiVersion: v1
    kind: Secret
    metadata:
      name: freedb-admin-secret
      namespace: oracle23ai
    type: Opaque
    stringData:
      ## Specify your DB password here
      oracle_pwd:  LiveLabs1
    </copy>
    ```

    Apply Kubernetes manifest file using **kubectl apply -f**

    ```bash
    <copy>kubectl create -f free-admin-secret.yaml -n oracle23ai</copy>
    ```

## Task 2: Provision containerized Oracle Database  23ai using Database Operator

1. Create Oracle Database 23ai Free Single Instance Kubernetes manifest file.

   Copy the below and paste into an editor, save as **singleinstancedatabase_free.yaml**

    ```bash
    <copy>
    apiVersion: database.oracle.com/v1alpha1
    kind: SingleInstanceDatabase
    metadata:
      name: freedb-livelabs
      namespace: oracle23ai
    spec:

      ## Use only alphanumeric characters for sid
      sid: FREE

      ## DB edition
      edition: free

      ## Secret containing SIDB password mapped to secretKey
      adminPassword:
        secretName: freedb-admin-secret

      ## Database image details
      image:
      ## Oracle Database Free is only supported from DB version 23.2 onwards
        pullFrom: container-registry.oracle.com/database/free:latest
        prebuiltDB: true

      ## size is the required minimum size of the persistent volume
      ## storageClass is specified for automatic volume provisioning
      ## accessMode can only accept one of ReadWriteOnce, ReadWriteMany
      persistence:
        size: 50Gi
        ## oci-bv applies to OCI block volumes,
        ## update as required
        storageClass: "px-csi-ora"
        accessMode: "ReadWriteOnce"

      ## Count of Database Pods. Should be 1 for free edition.
      replicas: 1
      </copy>
      ```

2. Apply Kubernetes Manifest file

    Apply Kubernetes manifest file using **kubectl apply -f < filename >**

      ```bash
      <copy>kubectl create -f singleinstancedatabase_free.yaml -n oracle23ai</copy>
      ```

    Example output:

     ```text
     % kubectl create -f singleinstancedatabase_free.yaml -n oracle23ai
     singleinstancedatabase.database.oracle.com/freedb-livelabs created
    ```

## Task 3: Review Database 23ai Free

   1. Review Database Status

      Use **kubectl get singleinstancedatabase** to return database status, the status will change from *Pending* -> *Creating* -> *Patching* -> *Healthly*

      ```bash
      <copy>kubectl get singleinstancedatabase  -n oracle23ai</copy>
      ```

      Example output:

      ```text
      kubectl get singleinstancedatabase  -n oracle23ai
      NAME              EDITION   STATUS    ROLE      VERSION        CONNECT STR              TCPS CONNECT STR   OEM EXPRESS URL
      freedb-livelabs   Free      Healthy   PRIMARY   23.4.0.24.05   10.0.10.133:30623/FREE   Unavailable        Unavailable
      ```

   2. Review Detailed Database Status

      Use **kubectl describe singleinstancedatabase** to return database status

      ```bash
      <copy>kubectl describe singleinstancedatabase freedb-livelabs -n oracle23ai</copy>
      ```

      Example output:

      ```text
      Name:         freedb-livelabs
      Namespace:    default
      Labels:       <none>
      Annotations:  <none>
      API Version:  database.oracle.com/v1alpha1
      Kind:         SingleInstanceDatabase
      Metadata:
        Creation Timestamp:  2024-05-30T16:13:32Z
        Finalizers:
          database.oracle.com/singleinstancedatabasefinalizer
        Generation:        1
        Resource Version:  156507
        UID:               39f959c6-8e06-41a3-bcd2-a75089a5d75b
      Spec:
        Admin Password:
          Keep Secret:  true
          Secret Key:   oracle_pwd
          Secret Name:  freedb-admin-secret
        Create As:      primary
        Edition:        free
        Image:
          Prebuilt DB:  true
          Pull From:    container-registry.oracle.com/database/free:latest
        Pdb Name:       FREEPDB1
        Persistence:
          Access Mode:    ReadWriteOnce
          Size:           50Gi
          Storage Class:  px-csi-ora
        Replicas:         1
        Sid:              FREE
      Status:
        Archive Log:             false
        Cluster Connect String:  freedb-livelabs-ext.default:1521/FREE
        Conditions:
          Last Transition Time:  2024-05-30T16:14:47Z
          Message:               no reconcile errors
          Observed Generation:   1
          Reason:                LastReconcileCycleQueued
          Status:                True
          Type:                  ReconcileQueued
          Last Transition Time:  2024-05-30T16:15:03Z
          Message:               processing datapatch execution
          Observed Generation:   1
          Reason:                LastReconcileCycleBlocked
          Status:                True
          Type:                  ReconcileBlocked
          Last Transition Time:  2024-05-30T16:15:03Z
          Message:               no reconcile errors
          Observed Generation:   1
          Reason:                LastReconcileCycleCompleted
          Status:                True
          Type:                  ReconcileComplete
        Connect String:          10.0.10.171:31134/FREE
        Created As:              primary
        Datafiles Created:       true
        Datafiles Patched:       false
        Edition:                 Free
        Flash Back:              false
        Force Log:               false
        Init Params:
          Cpu Count:             2
          Pga Aggregate Target:  512
          Processes:             200
          Sga Target:            1536
        Is Tcps Enabled:         false
        Oem Express URL:         Unavailable
        Pdb Connect String:      10.0.10.171:31134/FREEPDB1
        Pdb Name:                FREEPDB1
        Persistence:
          Access Mode:            ReadWriteOnce
          Size:                   50Gi
          Storage Class:          px-csi-ora
        Prebuilt DB:              true
        Release Update:           23.4.0.24.05
        Replicas:                 1
        Role:                     PRIMARY
        Sid:                      FREE
        Status:                   Healthy
        Tcps Connect String:      Unavailable
        Tcps Pdb Connect String:  Unavailable
        Tcps Tls Secret:
      Events:
        Type    Reason              Age                    From                    Message
        ----    ------              ----                   ----                    -------
        Normal  Database Pending    6m57s (x3 over 7m13s)  SingleInstanceDatabase  waiting for a pod to get to running state
        Normal  Database Unhealthy  5m58s (x4 over 6m43s)  SingleInstanceDatabase  datafiles exists
        Normal  Database Ready      5m43s (x2 over 5m56s)  SingleInstanceDatabase  database open on pod freedb-livelabs-oyhqq scheduled on node 10.0.10.171
        Normal  Datapatch Pending   5m42s (x2 over 5m55s)  SingleInstanceDatabase  datapatch execution pending
        Normal  Datapatch Check     5m42s                  SingleInstanceDatabase  datapatch not supported for free edition
      ```

   3. Review Single Instance Database

      Get Database Health

      ```bash
      <copy>kubectl get singleinstancedatabase freedb-livelabs -n oracle23ai -o "jsonpath={.status.status}"</copy>
      ```

      Database Name

      ```bash
      <copy>kubectl get singleinstancedatabase freedb-livelabs -n oracle23ai -o "jsonpath={.status.sid}"</copy>
      ```

      Database Connection String

      ```bash
      <copy>kubectl get singleinstancedatabase freedb-livelabs -n oracle23ai -o "jsonpath={.status.connectString}"</copy>
      ```

      Pluggable Database (PDB) Name

      ```
      <copy>kubectl get singleinstancedatabase freedb-livelabs -n oracle23ai -o "jsonpath={.status.pdbName}"</copy>
      ```

      Pluggable Database (PDB) Connection String

      ```bash
      <copy>kubectl get singleinstancedatabase freedb-livelabs -n oracle23ai -o "jsonpath={.status.pdbConnectString}"</copy>
      ```

## Task 4: Connect to Database 23ai Free

  1. Connect to Database

      Use **kubectl get singleinstancedatabase** to return database status, the status will change from *Pending* -> *Creating* -> *Patching* -> *Healthly*

      Get Database Name

      ```bash
      <copy>export ORA_NAME=$(kubectl get singleinstancedatabase -n oracle23ai -o 'jsonpath={.items[0].metadata.name}')</copy>
      ```

      Get Pod

      ```bash
      <copy>export ORA_POD=$(kubectl get pods -n oracle23ai -o jsonpath='{.items[0].metadata.name}')</copy>
      ```

      Run sqlplus with Oracle Database 23ai Free container

      ```bash
      <copy>kubectl exec -it pods/${ORA_POD} -n oracle23ai -- sqlplus sys/LiveLabs1@${ORA_NAME} as sysdba</copy>
      ```

      Example output:

      ```text
      % kubectl exec -it pods/${ORA_POD} -n oracle23ai -- sqlplus sys/LiveLabs1@${ORA_NAME} as sysdba
      Defaulted container "freedb-livelabs" out of: freedb-livelabs, init-prebuiltdb (init)

      SQL*Plus: Release 23.0.0.0.0 - Production on Tue Jun 4 16:42:08 2024
      Version 23.4.0.24.05

      Copyright (c) 1982, 2024, Oracle.  All rights reserved.


      Connected to:
      Oracle Database 23ai Free Release 23.0.0.0.0 - Develop, Learn, and Run for Free
      Version 23.4.0.24.05

      SQL>
      ```

  2. Confirm Oracle version

     Check Oracle Database version using the v$version view.

     ```sql
     <copy>select BANNER_FULL from v$version;</copy>
     ```

     Example output:

     ```text
     BANNER_FULL
     --------------------------------------------------------------------------------
     Oracle Database 23ai Free Release 23.0.0.0.0 - Develop, Learn, and Run for Free
     Version 23.4.0.24.05
     ```

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
