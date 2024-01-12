# Create Portworx managed PVC

## Introduction

In this lab will learn how to create a Kubernetes Persistent Volume Claim using a Portworx Storage Class.

Estimated Lab Time: 10 minutes

**Portworx** is a software defined storage overlay that allows you to:

* Run containerized stateful applications that are highly-available (HA) across multiple nodes, cloud instances, regions, data centers or even clouds
* Migrate workflows between multiple clusters running across same or hybrid clouds
* Run hyperconverged workloads where the data resides on the same host as the applications
* Have programmatic control on your storage resources

### Objectives

In this lab, you will:

* Review available Kubernetes Storage Classes
* Create a Portworx managed Persistent Volume Claim (PVC)

### Prerequisites

This lab assumes you have:

* A running OKE Cluster
* Portworx Cloud Native Storage deployed
* OCI CLI configured
* kubectl configured

## Task 1: Review Storage Classes

A Storage Class provides a way for administrators to describe the “classes” of storage they offer. Different classes might map to quality-of-service levels, or to backup policies, or to arbitrary policies determined by the cluster administrators.

By default OKE provides two Kubernetes Storage Classes *oci-bv* and *oci*, Portworx provides a number of additional Kubernetes Storage Classes which can be used to provide persistent storage to applications.

1. Review Storage Classes using *kubectl get storageclass* or *sc* to list available Storage Classes

     ```bash
     <copy>kubectl get sc</copy>
     ```

    Example output:

    ```text
    % kubectl get sc
    NAME                                 PROVISIONER                       RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
    oci                                  oracle.com/oci                    Delete          Immediate              false                  3d
    oci-bv (default)                     blockvolume.csi.oraclecloud.com   Delete          WaitForFirstConsumer   true                   3d
    px-csi-db                            pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-db-cloud-snapshot             pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-db-cloud-snapshot-encrypted   pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-db-encrypted                  pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-db-local-snapshot             pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-db-local-snapshot-encrypted   pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-replicated                    pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-csi-replicated-encrypted          pxd.portworx.com                  Delete          Immediate              true                   3h36m
    px-db                                kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-db-cloud-snapshot                 kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-db-cloud-snapshot-encrypted       kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-db-encrypted                      kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-db-local-snapshot                 kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-db-local-snapshot-encrypted       kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-replicated                        kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    px-replicated-encrypted              kubernetes.io/portworx-volume     Delete          Immediate              true                   3h36m
    stork-snapshot-sc                    stork-snapshot                    Delete          Immediate              true                   3h36m
    ```

## Task 2. Describe Storage Class

Every StorageClass has a **Provisioner**, **Parameters** and **ReclaimPolicy**, we can review the details using *kubectl describe storageclass* or *sc*

1. Describe StorageClass *px-csi-db*

     ```bash
     <copy>kubectl describe sc/px-csi-db</copy>
     ```

## Task 3. Create Portworx Managed Persistent Volume Claim (PVC)

Create Persistent Volume Claim referencing the *px-csi-db* StorageClass

1. Create a file called **px-ora-pvc.yaml** file using the example below.

    ```bash
    <copy>
    kind: PersistentVolumeClaim
    apiVersion: v1
    metadata:
      name: px-ora-pvc
    spec:
      storageClassName: px-csi-db
      accessModes:
        - ReadWriteOnce
      resources:
        requests:
            storage: 10Gi
    </copy>
    ```

    In the above example

    * **name**: *px-ora-pvc* name of the PVC.
    * **storageClassName**: *px-csi-db* indicates that PVC should be created using the provisioner and parameters specified in the StorageClass
    * **accessMode**: *ReadWriteOnce* indicates that only one pod is allowed to read and write to the volume.
    * **storage**: *10Gi* indicates this is a 10GiB PVC.

2. Run the *kubectl apply -f* command to create a new PVC

     ```bash
     <copy>kubectl apply -f px-ora-pvc.yaml</copy>
     ```

3. Describe the newly created PVC using *kubectl describe pvc*

     ```bash
     <copy>kubectl describe pvc/px-ora-pvc</copy>
     ```

4. Use *kubectl get pvc* to check status of the PVC

     ```bash
     <copy>kubectl get pvc/px-ora-pvc</copy>
     ```

   Example output

     ```text
     kubectl get pvc/px-ora-pvc
     NAME         STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   AGE
     px-ora-pvc   Bound    pvc-7e15fb55-d9f0-456b-9b47-8ed9b2fac0d0   10Gi       RWO          px-csi-db      108
     ```

## Learn More

* [Container Engine for Kubernetes](https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm)
* [Kubernetes Documentation](https://kubernetes.io/docs/home/)
* [Portworx Documentation](https://docs.portworx.com/portworx-enterprise/)
* [ronekins.com](https://ronekins.com/)

## Acknowledgements

* **Author** - [Ron Ekins](https://ace.oracle.com/apex/ace/profile/ronekins), Oracle ACE Director, Database Practice Lead for EMEA & LATAM @ Pure Storage
* **Last Updated By/Date** - Ron Ekins, January 2024
