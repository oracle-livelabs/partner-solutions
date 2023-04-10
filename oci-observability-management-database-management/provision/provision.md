# Provision the environment

## Introduction

In this lab, we will create the infrastructure that will be use in this lab. The infrastructure will content the network components (VCN, subnets, NSG, etc) and we will provision one DBCS and one ATP.

Estimated Time: 45 minutes

### Objectives

In this lab, you will:
* Create the network infrastructure
* Provision one DBCS
* Provision one ATP
* Create the Database Management Private Endpoint

### Prerequisites

This lab assumes you have the necessary privileges for the creation of all the components.

## Task 1: Create the network components

1. From OCI Console main page, click on *Set up a network with wizard*.

	![Image alt text](images/image1.png)

2. Click on *Start VCN Wizard*

	![Image alt text](images/image2.png)

3. Provide the VCN Name and the Compartment *LiveLabs*. You have to provide the VCN CIDR block.

	![Image alt text](images/image3.png)

4. Provide the CIDR block for the public and private subnets and click on *Next*.

	![Image alt text](images/image4.png)

5. Validate the *Review and create* page and click on *Create*.

	![Image alt text](images/image5.png)

6. The VCN is successfully created.

	![Image alt text](images/image6.png)

## Task 2: Create the DBCS

1. Click the navigation menu, click the link *Oracle Database*, and then *Oracle Base Database (VM, BM)*.

	![Image alt text](images/image7.png)

2. Select the compartment *LiveLabs* and clikc on *Create DB system*.

	![Image alt text](images/image8.png)

3. Provide the following information, Name of the DB System *DBSystem-LiveLabs*, Change the shape for *1 core*

	![Image alt text](images/image9.png)


4. Change the Oracle Database software edition to *Enterprise Edition*. Add your SSH key and select *Bring Your Own License (BYOL)*.

	![Image alt text](images/image10.png)

5. Provide the VCN and private subnet information and the hostname and click on *Next*.

	![Image alt text](images/image11.png)

6. Provide the Database name, the PDB name and password with sys and TDE. You can also disable database backups. Click on *Create DB system*.

	![Image alt text](images/image12.png)


## Task 3: Create the ADB

## Task 4: Create the Database Management Private Endpoint

## Task 5: Create the NSG

## Learn More

*(optional - include links to docs, white papers, blogs, etc)*

* [URL text 1](http://docs.oracle.com)
* [URL text 2](http://docs.oracle.com)

## Acknowledgements
* **Author** - <Name, Title, Group>
* **Contributors** -  <Name, Group> -- optional
* **Last Updated By/Date** - <Name, Month Year>
