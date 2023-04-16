# Register the DBCS in Database Management service

## Introduction

In this lab, we will register the DBCS in Observability & Management Database Management service. The Database Management Private Endpoint allows the communication between the subnet where the database is running on the Database Management service. Vault is also used to securely use DBSNMP password.

Estimated Time: 10 minutes

### Objectives

In this lab, you will:
* Register the DBS in Database Management Service

### Prerequisites

This lab assumes you have the necessary privileges for the creation of all the components.

## Task 1: Check the status of Database Management

1. Click the navigation menu, click the link *Oracle Database*, and then *Oracle Base Database (VM, BM)*.

  ![Image alt text](images/image1.png)

2. Select the DBCS *DBSystem-LiveLabs*. Make sure to be in the compartement *LiveLabs*.

  ![Image alt text](images/image2.png)

3. From the *DBSystem-LiveLabs* homepage, click on the database *CDB01* under the menu *Databases (1)*.

  ![Image alt text](images/image3.png)

4. From the *CDB01* homepage, go down the page and you will see the status of *Database Management* is *Not enabled*. You will notice some metrics displayed coming the namespace *oci_database*. This namespace is the default metric namespace when Database Management is not enabled and provides 13 different metrics.

  ![Image alt text](images/image4.png)

## Task 2: Enable Database Management for the CDB

1. In the *CDB01* homepage, under *Associated services / Database Management:*, click *Enable*.

  ![Image alt text](images/image5.png)

2. Validate the following information.

  ![Image alt text](images/image6.png)

3. Provide the Database user name *dbsnmp* you have configured in Lab #2, the secret information `DBSystem-LiveLabs_DBSNMP` and the private endpoint `LiveLabs_DBMGMT_PrivateEndpoint` also created in Lab #2.

  ![Image alt text](images/image7.png)

4. Select the Management option *Full Management*, and click on *Enable Database Management*.

  ![Image alt text](images/image8.png)

5. You can follow the progression of the process under *Work requests* menu. If the process fails, you can also have the log and error messages.

  ![Image alt text](images/image9.png)

6. Once the registration is completed, you will notice the status of Database management is either *Full* or *Basic* and you will be able to select another metric namespace `oracle_oci_database`. This namespace provides more database metrics (38) than the default one (13).

  ![Image alt text](images/image10.png)


## Learn More

*(optional - include links to docs, white papers, blogs, etc)*

* [URL text 1](http://docs.oracle.com)
* [URL text 2](http://docs.oracle.com)

## Acknowledgements
* **Author** - <Name, Title, Group>
* **Contributors** -  <Name, Group> -- optional
* **Last Updated By/Date** - <Name, Month Year>
