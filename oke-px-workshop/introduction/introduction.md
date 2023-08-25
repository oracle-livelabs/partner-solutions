# Introduction

## About this Workshop

**Oracle Container Engine for Kubernetes (OKE)** is a managed container orchestration service to deploy and manage containerized applications. It is based on the open source Kubernetes system and is available on the Oracle public cloud. The Kubernetes master nodes are managed by Oracle and the agent nodes are managed by the users. As it is a managed service, OKE is free, you only need to pay for agent nodes. OKE can be created in the Oracle console, with the OCI CLI, using Terraform.

**Portworx** is a software defined storage overlay that allows you to:

* Run containerized stateful applications that are highly-available (HA) across multiple nodes, cloud instances, regions, data centers or even clouds
* Migrate workflows between multiple clusters running across same or hybrid clouds
* Run hyperconverged workloads where the data resides on the same host as the applications
* Have programmatic control on your storage resources

This lab will provide a step by step guide to deploy an OKE cluster, deploy Portworx Enterprise Cloud Native Storage and create your first PVC (Persistent Volume Claim)

Estimated Workshop Time: 60 minutes

### Objectives

In this workshop, you will learn how to:

* Provision an Oracle Container Engine for Kubernetes (OKE) Cluster
* Deploy Portworx Enterprise Cloud Native Storage on OKE
* Create your first PVC (Persistent Volume Claim)

### Prerequisites (Optional)

* Familiarity with kubectl is helpful

This lab assumes you have:

* An Oracle Cloud account
* A Portworx Central account
* kubectl installed locally
* Oracle CLI configured

## Learn More

* [Portworx Documentation](https://docs.portworx.com/portworx-enterprise/)
* [Ron's Blog](https://ronekins.com/?s=oke)

## Acknowledgements

* **Author** - Ron Ekins, Oracle ACE Director, EMEA Practice Leader, Databases, Pure Storage
* **Last Updated By/Date** - Ron Ekins, September 2023
