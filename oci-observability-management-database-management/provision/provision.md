# Provision the environment

## Introduction

In this lab, we will create the infrastructure that will be use to complete all the following labs. The infrastructure will contain the network components (VCN, subnets, NSG, etc), one Database Cloud Service (DBCS) and one Autonomous Database (ADB).

To enable Database Management for the DBCS, we will need to create a Vault entry to securely store the password as well as the Database Management Private Endpoint.

Estimated Time: 45 minutes

### Objectives

In this lab, you will:
* Create the network infrastructure
* Create one Enterprise Edition DBCS and a Vault entry
* Create the Database Management Private Endpoint and Network Security Group (NSG)
* Create one Enterprise Edition ADB


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

## Task 2: Create the DBCS and Vault entry

1. Click the navigation menu, click the link *Oracle Database*, and then *Oracle Base Database (VM, BM)*.

	![Image alt text](images/image7.png)

2. Select the compartment *LiveLabs* and click on *Create DB system*.

	![Image alt text](images/image8.png)

3. Provide the following information, Name of the DB System *DBSystem-LiveLabs*, Change the shape for *1 core*

	![Image alt text](images/image9.png)


4. Change the Oracle Database software edition to *Enterprise Edition*. Upload your SSH key.

	![Image alt text](images/image10.png)

5. Select *Bring Your Own Licence* type. To ease the access to the DBCS during the lab, provide the VCN and public subnet information and the hostname and click on *Next*.

	![Image alt text](images/image11.png)

6. Provide the Database name, the PDB name. and password with sys and TDE. You can also disable database backups. Click on *Create DB system*.

	![Image alt text](images/image12.png)

6. Using your prefered client tool, connect to the new CDB using *sys* user. Run the following SQL statements to configure the DBSNMP user account. This user will be used by Database Management.

	```
	<copy>GRANT CREATE PROCEDURE TO DBSNMP;</copy>
	<copy>GRANT SELECT ANY DICTIONARY, SELECT_CATALOG_ROLE TO DBSNMP;</copy>
	<copy>GRANT ALTER SYSTEM TO DBSNMP;</copy>
	<copy>GRANT ADVISOR TO DBSNMP;</copy>
	<copy>GRANT EXECUTE ON DBMS_WORKLOAD_REPOSITORY TO DBSNMP;</copy>
	<copy>GRANT CREATE SESSION TO DBSNMP;</copy>
	<copy>ALTER USER DBSNMP ACCOUNT UNLOCK;</copy>
	<copy>ALTER USER DBSNMP IDENTIFIED BY "<password>";</copy>
	```

7. The service Vault is necessary to securely store DBSNMP password. Click the navigation menu, click the link *Identity & Security* and click on *Vault*

	![Image alt text](images/image13.png)

8. Make sure you are in the compartment *LiveLabs* and click on *Create Vault*

	![Image alt text](images/image14.png)

9. Provide the name *LiveLabs_Vault1* and click on *Create Vault*

	![Image alt text](images/image15.png)

10. Select the newly created vault and click on *Master Encryption Keys* under *Resources*. Click on *Create Key*.

	![Image alt text](images/image16.png)

11. Make sure you are in the compartment *LiveLabs*, use Protection Mode *Software* and provide the name *DBSystem-LiveLabs_Key*. Click on *Create Key*.

	![Image alt text](images/image17.png)

12. Select the newly created vault and click on *Secret* under *Resources*. Click on *Create Secret*.

	![Image alt text](images/image18.png)

13. Make sure you are in the compartment *LiveLabs*, provide the name *DBSystem-LiveLabs_DBSNMP*, the description *Password of the user DBSNMP*, select the Encrytion Key previously created, and provide the secret content, the password of DBSNMP. Click on *Create Secret*.

	![Image alt text](images/image19.png)

## Task 3: Create the Database Management Private Endpoint and Network Security Group (NSG)

The database management private endpoint resides in the database subnet and allows the communication between the database and Database Management service.

1. Click the navigation menu, click the link *Observability & Management*, and then *Administration * under *Database Management*.

	![Image alt text](images/image20.png)

2. Select *Private Endpoint* under *Administration*. Make sure you are in the compartement *LiveLabs* and click on *Create private endpoint*.

	![Image alt text](images/image21.png)

3. Provide the name *LiveLabs_DBMGMT_PrivateEndpoint*, the description *Database Management PrivateEndpoint for compartment LiveLabs*, make sure you are in the compartment *LiveLabs* and provide the VCN and public subnet information where the DBCS resides. Click on *Create private endpoint*.

	![Image alt text](images/image22.png)

	> **_NOTE:_** The information for the Network Security Group will be provided later in the lab. Leave the section empty.

4. Click on the newly created private endpoint and take note of the *Private IP*.

	![Image alt text](images/image23.png)

5. The NSG will allow the communication between the database systems and the Database Management service through the private endpoint. Click the navigation menu, click the link *Virtual cloud networks*, select the VCN *VCN_LiveLabs*, click on *Network Security Groups (0)* and click on *Create Network Security Group*

	![Image alt text](images/image24.png)

5. Provide the name *NetworkSecurityGroup_LiveLabs_DatabaseManagement* and make sure you are in the compartment *LiveLabs*. Click on *Next*.

	![Image alt text](images/image25.png)

6. Provide the required 2 *Security Rules*. Click on *Create*.

	![Image alt text](images/image26.png)

| Direction  | Source Type | Source CIDR | IP Protocol | Destination Port | Description |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| Ingress  | CIDR  | IP address of the Database Management Private Endpoint (10.0.0.172/32) | TCP | 1521 | Connection from Database Management from any port to any database system on port 1521 in the database subnet |
| Egress  | CIDR  | Range IP address of the database subnet (10.0.0.0/24) | TCP | 1521 | Database Management is sending request to the any database system on port 1521 in the database subnet |

6. Assign the new NSG to the database system. From the DBCS homepage, click on *Edit* next to *Network security groups*.

	![Image alt text](images/image27.png)

7. Select `NetworkSecurityGroup_LiveLabs_DatabaseManagement` and click on *Save changes*.

	![Image alt text](images/image28.png)

8. Assign the new NSG to the Database Management Private Endpoint. Select the private endpoint and click on *Network Security Groups: 0*.

	![Image alt text](images/image29.png)

9. Select `NetworkSecurityGroup_LiveLabs_DatabaseManagement` and click on *Save changes*.

	![Image alt text](images/image30.png)



## Task 4: Create the ADB

1. Click the navigation menu, click the link *Oracle Database*, and then *Autonomous Transaction Processing*.

	![Image alt text](images/image93.png)

2. Select the compartment *LiveLabs* and click on *Create Autonomous Database*.

	![Image alt text](images/image94.png)

3. Provide the following information, Compartment *LiveLabs*, Display Name, Database Name. Select the desired workload type.

	![Image alt text](images/image95.png)

4. Select the Deployment type. Make sure not to use *Always Free* ADB.

	![Image alt text](images/image96.png)

5. Continue by providing the *ADMIN* password. To ease the access to the ADB during the lab, select *Secure access from everywhere*.

	![Image alt text](images/image97.png)

6. Complete by providing the licence type, Database Edition *Enterprise Edition* and a contact email. Click on *Create Autonomous Database*.

	![Image alt text](images/image98.png)





## Learn More

*(optional - include links to docs, white papers, blogs, etc)*

* [URL text 1](http://docs.oracle.com)
* [URL text 2](http://docs.oracle.com)

## Acknowledgements
* **Author** - <Name, Title, Group>
* **Contributors** -  <Name, Group> -- optional
* **Last Updated By/Date** - <Name, Month Year>
