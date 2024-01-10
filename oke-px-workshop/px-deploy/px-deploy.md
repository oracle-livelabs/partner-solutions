# Install Portworx on Oracle Container Engine for Kubernetes (OKE)

## Introduction

In this lab will learn how to deploy Portworx Enterprise for OKE into an existing OKE cluster.

Estimated Time: 10 minutes

**Portworx** is a software defined storage overlay that allows you to:

* Run containerized stateful applications that are highly-available (HA) across multiple nodes, cloud instances, regions, data centers or even clouds
* Migrate workflows between multiple clusters running across same or hybrid clouds
* Run hyperconverged workloads where the data resides on the same host as the applications
* Have programmatic control on your storage resources

### Objectives

In this lab, you will:

* Create Portworx specification
* Deploy Portworx Operator
* Deploy Portworx Storage Cluster
* Review Portworx install

### Prerequisites

This lab assumes you have:

* An OKE cluster that meets the Portworx prerequisites
* A Portworx Central Account
* A working knowledge of Kubernetes
* OCI CLI configured
* kubectl installed

## Task 1: Generate Specification

To install Portworx with Kubernetes, you must first generate Kubernetes manifests that you will deploy in your cluster. Once the spec is generated you must also install the Portworx Operator.

1. Navigate to [Portworx Central](https://central.portworx.com/) and sign-in using Portworx account details.
  ![Portworx Central](images/px-signin.png)

2. Select **Portworx Enterprise**.
  ![Portworx Catalog](images/px-catalog.png)

3. Select required version of Portworx, for this lab we use **Portworx Enterprise**, select and click continue.
  ![Portworx Catalog](images/px-product.png)

4. For **Platform**, select **Oracle**, then click **Customize** at the bottom of the **Summary** section.
  ![Portworx Catalog](images/px-platform.png)

5. Ensure that **Use the Portworx Operator** is selected, then select Portworx version 3.0 or higher. Update your cluster's **Kubernetes version**, then click **Next**.
  ![Portworx Catalog](images/px-basic.png)

6. In the **Storage** section, update **Select number of VPUs** (Volume Performance Units) for required OCI Oracle block volumes as per performance, defaulted to 10 (Balanced), and **Size(GBs) default (150GBs)
For Volume Performance Units (VPUs) options see: [OCI Block Volume Performance](https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/blockvolumeperformance.htm)
   ![Portworx Catalog](images/px-storage.png)

7. In the **Networking** section, accept defaults and click **Next**.
   ![Portworx Catalog](images/px-network.png)

8. In the **Customize** section, click **Finish** to generate the specs.
  ![Portworx Catalog](images/px-customize.png)

9. Within the Portworx Operator section, we can see 2 kubectl apply commands which we will use to deploy the Portworx Operator and Storage Cluster.
  ![Portworx Catalog](images/px-operator.png)

## Task 2: Deploy Portworx

Deploy Portworx using the commands provided from Portworx Central UI

1. Deploy Portworx Operator

   To deploy the Operator, run the generated *kubectl apply -f* command.

     ```bash
     <copy>kubectl apply -f 'https://install.portworx.com/3.0?comp=pxoperator&kbver=1.27.2&ns=portworx'</copy>
     ```

2. Deploy Storage Cluster

   To deploy the StorageCluster, run the command that Portworx Central provided, which looks similar to the following:

     ```bash
     kubectl apply -f “https://install.portworx.com/<portworx_version>?operator=true&mc=false&kbver=<k8s-version>&ns=portworx&b=true&kd=type%3Dpv-10%2Csize%3D150&mz=2&cp=oracle&s=%22type%3Dpv-10%2Csize%3D150%22%2C%22type%3Dpv-20%2Csize%3D150%22&j=auto&c=px-cluster-703d279b-ed06-4c39-9ff5-1f911204536e&oke=true&stork=true&csi=true&mon=true&tel=false&st=k8s&promop=true”
     ```

## Task 3: Review Portworx deployment

Once you've installed Portworx, you can perform the following tasks to verify that Portworx has installed correctly.

1. Verify Portworx pods are running.

   Enter the following kubectl get pods command to list and filter the results for Portworx pods:

     ```bash
     <copy>kubectl get pods -n portworx -l name=portworx</copy>
     ```

    Example output

     ```bash
     % kubectl get pods -n portworx -l name=portworx
     NAME                                                    READY   STATUS    RESTARTS      AGE
     px-cluster-5273270c-2996-4191-9d96-bfdb6e7459f5-qhbrd   2/2     Running   1 (50m ago)   65m
     px-cluster-5273270c-2996-4191-9d96-bfdb6e7459f5-rstx5   2/2     Running   1 (49m ago)   65m
     px-cluster-5273270c-2996-4191-9d96-bfdb6e7459f5-xwx2g   2/2     Running   1 (49m ago)   65m
     ```

2. Set up Portworx Control *pxctl*

   Export environmental variable

     ```bash
     <copy>export PX_POD=$(kubectl get pods -l name=portworx -n portworx -o jsonpath='{.items[0].metadata.name}')</copy>
    ```

    And alias

     ```bash
     <copy>alias pxctl='kubectl exec $PX_POD -n portworx -- /opt/pwx/bin/pxctl'</copy>
     ```

3. Portworx version

   Confirm version of Portworx using *pxctl --version*

     ```bash
     <copy>pxctl --version</copy>
     ```

    Example output

     ```bash
     % pxctl --version
     Defaulted container "portworx" out of: portworx, csi-node-driver-registrar
     pxctl version 3.0.4.0-1396ef3
     ```

4. Deployment Status

   Use **Status** of Portworx deployment using *pxctl status*

     ```bash
     <copy>pxctl status</copy>
     ```

5. Storage pools

   Use the *pxctl cluster provision-status* command to view OCI **Region** and **Availability Domain** of storage pools within the Portworx cluster.

     ```bash
     <copy>pxctl cluster provision-status</copy>
     ```

6. Cloud Drives

   The *pxctl clouddrive* command is useful for getting more insight into the OCI block volumes provisioned by Portworx, including the **OCID** for each block volume.

     ```bash
     <copy>pxctl clouddrive list</copy>
     ```

7. OCI Block Volumes

   Use *oci bv volume list* command with *–lifecyle-state* “Available” to list OCI block volumes in a JSON format, use grep to limit output to the display-name, for example.

     ```bash
     <copy>oci bv volume list --compartment-id <compartment id> --lifecycle-state "Available" | grep display-name</copy>
     ```

   Replace the *`<compartment id>`* with OCI compartment id

## Learn More

* [Container Engine for Kubernetes](https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm)
* [Kubernetes Documentation](https://kubernetes.io/docs/home/)
* [Portworx Documentation](https://docs.portworx.com/portworx-enterprise/)
* [ronekins.com](https://ronekins.com/)

## Acknowledgements

* **Author** - [Ron Ekins](https://ace.oracle.com/apex/ace/profile/ronekins), Oracle ACE Director, Database Practice Lead for EMEA & LATAM @ Pure Storage
* **Last Updated By/Date** - Ron Ekins, January 2024
