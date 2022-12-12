# Create OCI Identity and Access Management Resources

## Introduction

In this lab, we will create the required *Identity and Access Management* (IAM) resources that will be needed to support working with the Object Storage using the OCI REST APIs.

Estimated Time: 30 minutes

### About Identity and Access Management

The OCI IAM provides the necessary resources for managing user authentication, logically dividing resources into compartments, and managing authorizations using groups and policies. Tenancies today have access to IAM either with or without *Identity Domains*. The latter is the older version of IAM and on which this lab is based on.

### Objectives

In this lab, you will create the following IAM resources:

* A compartment for placing the Object Storage bucket.
* A group that is used in policy statements.
* A policy and its statements that define actions that members of a group may perform.
* A user that is used in applications to authenticate to the OCI REST APIs. Users are assigned to groups with the appropriate permissions.

## Task 1: Create a Compartment

1. Click the *navigation menu* (sometimes known as the "hamburger") button on the top left to show all the available menu items on the OCI Console.
![Open the OCI Console navigation menu.](./images/oci-navigation-menu.png)
1. Click the link *Identity & Security*, and then *Compartments*.
![Navigate to the Compartments page.](./images/navigate-to-compartments-page.png)
1. Click the *Create Compartment* button.
![Start the process for creating a new compartment.](./images/create-a-new-compartment.png)
1. Enter the required details, the *Name* and *Description*, and optionally, select a *Parent Compartment*. Click the *Create Compartment* button to create the desired compartment.
![Enter the required detais and create the compartment.](./images/enter-required-details-about-new-compartment.png)

## Task 2: Create a Group

1. Next, create an IAM group. Back on the *Compartments* page, under the *Identity* menu on the left, click the *Groups* link.
![Navigate to the Groups page.](./images/navigate-to-the-groups-page.png)
1. Click the *Create Group* button.
![Start the process for creating a new group.](./images/create-a-new-group.png)
1. Create a group named *DocumentManagers* and enter an appropriate description. Click the *Create* button to create the group.
![Enter the required details and create the group.](./images/enter-required-details-about-new-group.png)
1. Once the group has been created, check the details, and then click the breadcrumb *Identity* on the top-left of the page in preparation for the next task.
![Check the details of the group created.](./images/check-details-of-group-created.png)

## Task 3: Create a Policy

1. After the last task, you should be on the *Users* page. Again, under the *Identity* menu on the left, click the *Policies* link.
![Navigate to the Policies page.](./images/navigate-to-the-policies-page.png)
1. Click the *Create Policy* button.
![Start the process for creating a new policy.](./images/create-a-new-policy.png)
1. Create a policy named *DocumentManagementPolicy* and enter an appropriate description. Select the "root" compartment where this resource will be created in. Next, switch the *Show manual editor* toggle to enable.
![Enter details of the policy.](./images/enter-required-details-about-new-policy.png)
1. Enter the two statements below (tweak if necessary) and then click the *Create Policy* button.
	```text
	<copy>
	Allow group DocumentManagers to read buckets in compartment LiveLabs
	Allow group DocumentManagers to manage objects in compartment LiveLabs
	</copy>
	```
![Enter the policy statements manually.](./images/enter-policy-statements-manually.png)

> **NOTE:**
>
> A more restrictive policy can be used to restrict which buckets the *DocumentManagers* group members can manage objects. Look up the OCI document for [details](https://docs.oracle.com/iaas/Content/Identity/Reference/objectstoragepolicyreference.htm) on how these policy statements can be further modified to restrict access.

## Task 4: Create a User

1. Return to the *Users* page on the OCI console and click the *Create User* button.
![Start the process for creating a new user.](./images/create-a-new-user.png)
1. Select *IAM User* and enter a name and description for the user. Entering an email address is not necessary. Click the *Create* button to create the user.
![Enter a name and description for the user.](./images/enter-details-about-new-user.png)
1. On the user's details page, click the *Edit User Capabilities* button.
![Click to edit the user capabilities.](./images/edit-user-capabilities.png)
1. Uncheck all capabilities except *API Keys*, and then click the *Save Changes* button.
![Allow the user to generate and use only API keys for all OCI operations.](./images/allow-user-to-generate-api-keys-only.png)
1. Back on the user's details page, scroll down and then under the *Resources* menu on the left, click the *Groups* link. Then, click the *Add User to Group* button.
![Navigate to add user to a group.](./images/navigate-to-add-user-to-group.png)
1. Select the group created in Task 2, and then click the *Add* button.
![Add user to the group created in Task 2.](./images/add-user-to-group.png)

## Task 5: Generate API Keys for the User to Call OCI REST APIs Securely

1. The final task in this lab is to generate an API key. Under the *Resources* menu, click the *API Keys* link, and then click the *Add API Key* button.
![Start the process for adding an API key for the user.](./images/add-api-keys-for-user.png)
1. Select the *Generate API Key Pair* option to have the OCI Console generate the encryption key pair. Click the *Download Private Key* button to download the private key, and optionally, click the *Download Public Key* button to download its public counterpart. The latter can be generated from the private key later if required. Store the private key securely. Finally, click the *Add* button.
![Generate and download the API key pair.](./images/generate-download-api-key-pair.png)
1. Once the key pair has been created, the OCI Console will display configuration information that can be added to the OCI [*Command Line Interface*](https://docs.oracle.com/iaas/Content/API/Concepts/cliconcepts.htm) (CLI) configuration file. The same information is required for creating the Oracle APEX *Web Credentials* later, so please not the values of the fields listed below the image.
![Collect information.](./images/collect-information.png)
	* **user** - The [Oracle Cloud ID](https://docs.oracle.com/iaas/Content/General/Concepts/identifiers.htm) (OCID) for the user.
	* **fingerprint** - The fingerprint of the API's public key.
	* **tenancy** - The OCID for the tenancy.

> **NOTE:**
>
> Here, the API keys were generated using the OCI Console. Other alternative ways to create the private and public keys is to use either the OCI CLI, or [OpenSSL](https://www.openssl.org) that is installed in most modern operating systems.

You may not **proceed to the next lab**.
