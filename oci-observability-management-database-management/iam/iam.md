# Create OCI identity and Access Management Resources

## Introduction

In this lab, we will create the required Identity and Access Management (IAM) resources needed to support this workshop.

Estimated Time: 10 minutes

### Objectives

In this lab, you will:
* Create a compartment where the OCI components will reside
* Create a group
* Create policies

### Prerequisites

This lab assumes you have:
* A valid Oracle Cloud Infrastructure paid account.
* The necessary privileges to create the resources in this lab.

## Task 1: Create a "LiveLabs" compartment

1. Click the navigation menu, click the *Identity & Security* menu item, and then *Compartments*.

	![Image alt text](images/home-compartment.png)

2. Click the Create Compartment button. Enter the required details, the Name *LiveLabs* and Description *Compartment for LiveLabs*, select a Parent Compartment. Then, click the *Create Compartment* button to create the desired compartment.

	![Image alt text](images/create-compartment.png)

## Task 2: Create a group

1. Click the navigation menu, click the *Identity & Security* menu item, and then *Domains*.

	![Image alt text](images/home-group.png)

	> **_NOTE:_** For old tenancy without *Domains*, you will find the menu *Group* under *Identity*

2. Make sure you are in the root compartment and click on the *Default domain*.

	![Image alt text](images/default-domain.png)

3. Click on Groups and Create Group

	![Image alt text](images/create-group.png)

4. Enter the required details, the Name `DBMGMT_LiveLabs_Group` and Description *Database Management Group associated to the compartement LiveLabs* and select users to add to this group. Click on *Create*.

	![Image alt text](images/create-group-info.png)

## Task 3: Create policies

This policy allows the Management (dpd) service to read the secret in the Vault service for the tenancy.
1. Click the navigation menu, click the *Identity & Security* menu item, and then *Policies*.

	![Image alt text](images/home-policy.png)

2. Click the *Create Policy* button. Enter the required details, the Name `DBMGMT_Service_Policy_Tenancy` and Description *Service policy required for Database Management service to read secrets in Vault for the tenancy*. Select the *root* compartment where this resource will be created. Switch the Show manual editor toggle to enable.

	![Image alt text](images/create-policy.png)

	Enter the following rule and click *Create*.
	```
	<copy>Allow service dpd to read secret-family in tenancy</copy>
	```

This policy provides the necessary permissions to Database Management service.
3. Click the *Create Policy* button. Enter the required details, the Name `DBMGMT_User_Policy_LiveLabs` and Description *User policy for Database Management service for LiveLabs compartement*. Select the *root* compartment where this resource will be created. Switch the Show manual editor toggle to enable.

	Enter the following rules and click *Create*.
	```
	<copy>Allow group 'DBMGMT_LiveLabs_Group' to manage dbmgmt-family in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to manage metrics in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to manage alarms in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to manage objects in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to manage buckets in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to use database-family in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to use external-database-family in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to use autonomous-database-family in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to manage virtual-network-family in tenancy where any {target.compartment.name = 'LiveLabs'}
	Allow group 'DBMGMT_LiveLabs_Group' to manage secret-family in tenancy where any {target.compartment.name = 'LiveLabs'}</copy>
	```

You may now proceed to the next lab.

## Acknowledgements
* **Author** - Luc Demanche, Cloud & DBA Practice Director, Insum Solutions Inc.
* **Last Updated By/Date** - Luc Demanche, April 2023
