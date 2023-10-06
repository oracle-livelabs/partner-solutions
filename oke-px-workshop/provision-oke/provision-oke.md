# Provision Oracle Container Engine for Kubernetes (OKE) Cluster

## Introduction

In this lab will create an Oracle Container Engine for Kubernetes (OKE) cluster.

Estimated Time: 10 minutes

### About <Product/Technology> (Optional)
Enter background information here about the technology/feature or product used in this lab - no need to repeat what you covered in the introduction. Keep this section fairly concise. If you find yourself needing more than two sections/paragraphs, please utilize the "Learn More" section.

### Objectives

*List objectives for this lab using the format below*

In this lab, you will:
* Use the Oracle Cloud WebUI to provision an OKE cluster
* USe kubectl to confirm installation details

### Prerequisites (Optional)

*List the prerequisites for this lab using the format below. Fill in whatever knowledge, accounts, etc. is needed to complete the lab. Do NOT list each previous lab as a prerequisite.*

This lab assumes you have:
* An Oracle Cloud account
* Basic Kubernetes knowledge


*This is the "fold" - below items are collapsed by default*

## Task 1: Concise Task Description

(optional) Task 1 opening paragraph.

1. Step 1

	![Image alt text](images/sample1.png)

	> **Note:** Use this format for notes, hints, and tips. Only use one "Note" at a time in a step.

2. Step 2

  ![Image alt text](images/sample1.png)

4. Example with inline navigation icon ![Image alt text](images/sample2.png) click **Navigation**.

5. Example with bold **text**.

   If you add another paragraph, add 3 spaces before the line.

## Task 2: Concise Task Descriptio

1. Code examples that include variables

	```bash
  <copy>kubectl get nodes -L topology.kubernetes.io/region,topology.kubernetes.io/zone,oci.oraclecloud.com/fault-domain</copy>
  ```

  ```bash
  NAME          STATUS   ROLES   AGE     VERSION   REGION        ZONE               FAULT-DOMAIN
10.0.10.119   Ready    node    2m47s   v1.25.4   uk-london-1   UK-LONDON-1-AD-1   FAULT-DOMAIN-3
10.0.10.149   Ready    node    2m48s   v1.25.4   uk-london-1   UK-LONDON-1-AD-3   FAULT-DOMAIN-1
10.0.10.226   Ready    node    2m46s   v1.25.4   uk-london-1   UK-LONDON-1-AD-2   FAULT-DOMAIN-2
  ```

## Learn More

*(optional - include links to docs, white papers, blogs, etc)*

* [Container Engine for Kubernetes](https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm)
* [Kubernetes Documentation](https://kubernetes.io/docs/home/)

## Acknowledgements
* **Author** - Ron Ekins, Oracle ACE Director, EMEA Practice Leader, Databases, Pure Storage
* **Last Updated By/Date** - Ron Ekins, September 2023
