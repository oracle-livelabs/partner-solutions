# Prepare the Environment

## Introduction

In this lab, we will prepare the environment, the Oracle Cloud Infrastructure (OCI) tenancy, for this LiveLabs workshop. The completed environment will provide platforms for fine-tuning and training a large language model (LLM), deploying the trained model, and creating an Oracle APEX application that will use it.

Estimated Time: 30 minutes

### Objectives

In this lab, you will learn how to:

* Set up the required Identity Access Management resources and policies.
* Provision an Oracle Autonomous Database instance.
* Create an Oracle APEX workspace and a database schema.
* Create an OCI Data Science project and notebook session for training and deploying the LLM.

### Prerequisites

This lab assumes that you have:

* Access to an Oracle Cloud tenancy.
* The necessary privileges to create the resources in this lab.

## Task 1: Create a Compartment

1. Click the *navigation menu* (sometimes known as the "hamburger") button on the top left to show all the available menu items on the OCI Console.
![Open the OCI Console navigation menu.](./images/oci-navigation-menu.png)
1. Click the link *Identity & Security*, and then *Compartments*.
![Navigate to the Compartments page.](./images/navigate-to-compartments-page.png)
1. Click the *Create Compartment* button.
![Start the process for creating a new compartment.](./images/create-a-new-compartment.png)
1. Enter the required details, the *Name* and *Description*, and optionally, select a *Parent Compartment*. Click the *Create Compartment* button to create the desired compartment.
![Enter the required details and create the compartment.](./images/enter-required-details-about-new-compartment.png)

## Task 2: Create a Group

In tenancies provisioned with IAM using *identity domains*, users and groups are managed within domains. Such tenancies will have a *Default* domain created by default. We will create a new group in this task.

1. Access the navigation menu, and click the link *Identity & Security*. Under the *Identity* heading, click the link *Domains*.
![Navigate to the Domains page.](./images/navigate-to-the-domains-page.png)
1. Under the table of domains, click on the link to the *Default* domain. If you do not see the correct domain, on the left side of the page, check that the *root* compartment is selected.
![Navigate to the Default domain's page.](./images/navgate-to-the-default-domains-page.png)
1. On the left navigation menu, click the link *Groups*.
![Navigate to the Groups page.](./images/navigate-to-the-groups-page.png)
1. Click the *Create Group* button.
![Start the process for creating a new group.](./images/create-a-new-group.png)
1. Create a group named *ApexAgents* and enter an appropriate description. Click the *Create* button to create the group.
![Enter the required details and create the group.](./images/enter-required-details-about-new-group.png)
1. Validate that the group was created successfully.
![Check the details of the group created.](./images/check-details-of-group-created.png)

## Task 3: Create a User

1. While on the group's details page, a the top, click on the breadcrumb link *Default domain*, to return to the domain's details page.
![Navigate to the Default domain's details page.](./images/navigate-from-the-group-to-domains-details-page.png)
1. In the left navigation menu, click the link *Users*.
![Navigate to the Users page.](./images/navigate-to-the-users-page.png)
1. Click the *Create User* button.
![Start the process for creating a new user.](./images/create-a-new-user.png)
1. At minimum, enter a *Last name* and the desired *Username*. Depending on domain's settings, an email address is required. If a different username is desired, uncheck the option *Use the email address as the username*, and then enter **both** the *Username* and *Email* fields.
![Enter the details about the new user.](./images/enter-details-about-new-user.png)
1. Scroll down and assign the user to the group created in Task 1 by selecting the checkbox next to the desired group's name. Click the *Create* button to create the user.
![Assign user to the DocumentManagers group.](./images/assign-user-to-group.png)
1. On the user's details page, click the *Edit user capabilities* button.
![Click to edit the user capabilities.](./images/edit-user-capabilities.png)
1. Uncheck all capabilities except *API keys*, and then click the *Save changes* button.
![Allow the user to generate and use only API keys for all OCI operations.](./images/allow-user-to-generate-api-keys-only.png)

## Task 4: Generate API Keys for the User to Call OCI REST APIs Securely

1. From the user's details page, under the *Resources* menu, click the *API keys* link, and then click the *Add API key* button.
![Start the process for adding an API key for the user.](./images/add-api-keys-for-user.png)
1. Select the *Generate API key pair* option to have the OCI Console generate the encryption key pair. Click the *Download private key* button to download the private key, and optionally, click the *Download public key* button to download its public counterpart. The latter can be generated from the private key later if required. Store the private key securely. Finally, click the *Add* button.
![Generate and download the API key pair.](./images/generate-download-api-key-pair.png)
1. Once the key pair has been created, the OCI Console will display configuration information that can be added to the OCI [*Command Line Interface*](https://docs.oracle.com/iaas/Content/API/Concepts/cliconcepts.htm) (CLI) configuration file. The same information is required for creating the Oracle APEX *Web Credentials* later, so please copy and safely store the values of the fields listed below the image. Click the *Close* button when done.
![Collect information.](./images/collect-information.png)
	* **user** - The [Oracle Cloud ID](https://docs.oracle.com/iaas/Content/General/Concepts/identifiers.htm) (OCID) for the user.
	* **fingerprint** - The fingerprint of the API's public key.
	* **tenancy** - The OCID for the tenancy.

> **NOTE:**
>
> Here, the API keys were generated using the OCI Console. Other alternative ways to create the private and public keys is to use either the OCI CLI, or [OpenSSL](https://www.openssl.org) that is installed in most modern operating systems.

## Task 5: Create a Dynamic Group for Data Science Work

The OCI Data Science Service empowers you to build and deploy machine learning models quickly and easily. With a comprehensive platform featuring distributed training, batch processing, and automated model deployment, you can streamline the entire machine learning workflow. Its intuitive interface and user-friendly features make it ideal for both beginners and experienced data scientists alike.

The OCI Identity Access Management (IAM) Policies control access to Oracle Cloud resources by defining who can perform specific actions and under what circumstances. These flexible policies leverage a powerful rule-based engine to precisely tailor access based on user attributes, resource details, and access time parameters. By leveraging IAM Policies, organizations can achieve granular control over resource access, improve security, streamline workflows, and ensure efficient resource utilization.

First, create a dynamic group that includes various Data Science resources. This dynamic group will then be used to create policies that allow access to other OCI resources like Object Storage and Logging.

1. Navigate to the OCI tenancy's Domains page.
![Navigate to manage the OCI Domains.](./images/navigate-to-domains.png)
1. Select the Domain where the IAM resources will be managed, for example, *Default*.
![Select the Domain where the IAM resources will be managed.](./images/select-domain-default.png)
1. Go to the Dynamic Groups page.
![Navigate to manage the Default Domain's dynamic group.](./images/navigate-to-dynamic-groups.png)
1. Click the button *Create dynamic group*.
![Select the Domain where the IAM resources will be managed.](./images/click-create-dynamic-group.png)
1. Enter the name, description, and a first rule for the new dynamic group. Replace the `resource.compartment.id` with the appropriate OCID where the Data Science resources will be created in.
    ```
    <copy>
    ALL { resource.type = 'datasciencenotebooksession', resource.compartment.id = 'ocid1.compartment.oc1...' }
    </copy>
    ```
![Enter the name, description, and a first rule for the new dynamic group.](./images//provide-details-for-the-data-science-service-dynamic-group.png)
1. Click the button *+ Additional rule* button twice to add two more rules:
    ```
    <copy>
    ALL { resource.type = 'datasciencemodeldeployment', resource.compartment.id = 'ocid1.compartment.oc1...' }
    </copy>
    ```
    and
    ```
    <copy>
    ALL { resource.type = 'datasciencejobrun', resource.compartment.id = 'ocid1.compartment.oc1...' }
    </copy>
    ```
![Add two more rules to the dynamic group.](./images/add-rules-to-the-data-science-service-dynamic-group.png)
1. Click the button *Create* to complete this task.

## Task 6: Create Policies for Consuming the Model Predict URL and OCI Data Science

1. Access the navigation menu, and click the link *Identity & Security*. Under the *Identity* heading, click the link *Policies*.
![Navigate to the Policies page.](./images/navigate-to-the-policies-page.png)
1. Click the *Create Policy* button.
![Start the process for creating a new policy.](./images/create-a-new-policy.png)
1. Create a policy named *DataScienceModelPredictPolicy* and enter an appropriate description. Select the "root" compartment where this resource will be created in. Next, switch the *Show manual editor* toggle to enable.
![Enter details of the policy.](./images/enter-required-details-about-new-policy.png)
1. Enter the two statements below (tweak if necessary) and then click the *Create* button.
	```text
	<copy>
	allow group 'Default'/'ApexAgents' to {DATA_SCIENCE_MODEL_DEPLOYMENT_PREDICT}  in compartment LiveLabs
	</copy>
	```
![Enter the policy statements manually.](./images/enter-policy-statements-manually.png)
1. Repeat the steps 1 to 3, and create another policy called *DataScienceWorkPolicy* required for training and deploying the machine learning model on the OCI Data Science Service. It must contain the following policy statements:
    ```
    <copy>
    allow service datascience to use virtual-network-family in tenancy
    allow dynamic-group 'Default'/'DataScienceService' to read log-groups in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to use log-content in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to read virtual-network-family in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to manage data-science-family in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to manage object-family in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to read repos in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to use vaults in compartment LiveLabs
    allow dynamic-group 'Default'/'DataScienceService' to manage keys in compartment LiveLabs
    </copy>
    ```

## Task 7: Provision an Oracle Autonomous Database

The Oracle Autonomous Database is a fully managed and automated database service that eliminates the burden of database management. It automatically heals, manages, and scales itself, ensuring high availability and scalability. This simplifies database administration, boosts productivity, and reduces costs for organizations.

1. Click the *navigation menu* button on the top left to show all the available menu items on the OCI Console, *Oracle Database*, and then *Autonomous Database*.
![Navigate to the Autonomous Database page.](./images/navigate-to-the-autonomous-database-page.png)
1. Click the *Create Autonomous Database* button.
![Click the Create Autonomous Database button.](./images/create-a-new-autonomous-database.png)
1. Begin by choosing the target compartment to create the database. Next, enter a suitable *Display name* and *Database name*. Then, select the desired the workload type, for example, *Transaction Processing*.
![Enter a suitable display and database name, and then choose the desired workload type.](./images/enter-required-details-for-new-autonomous-database.png)
1. Scroll down and select the *Serverless* deployment type.
![Choose deployment type](./images/choose-deployment-type.png)
1. For this workshop, select *Always Free* option if within the tenancy's service limits. For Always Free databases, the *OCPU count* and storage limits are fixed. Also, auto scaling is not available for both OCPU and storage. Select the database version *19c* and then scroll down again.
![Specify if this is an Always Free instance, and if required, provide the OCPU and storage limits.](./images/configure-autonomous-database-resources.png)
1. Enter a password (twice) that meets the database's password complexity rules. It must be between 12 and 30 characters long and must include at least one uppercase letter, one lowercase letter, and one numeric character. It should not include the word *admin*.
![Enter a valid password for the autonomous database.](./images/enter-valid-password-for-autonomous-database.png)
1. Scroll down once more. If this is an Always Free ADB, then the license type choice is set. If not, select the license type that is appropriate to the tenancy. Next, optionally provide an email address to be contacted about announcements and notifications concerning the newly provisioned instance. Finally, click the *Create Autonomous Database* button.
![Select the license type and provide contacts for the ADB.](./images/select-license-type-and-provide-contacts-for-autonomous-database.png)

## Task 8: Create an Oracle APEX Workspace and Database Schema

Oracle APEX is a web-based development platform that simplifies application development without compromising power or flexibility. Its intuitive interface and low-code approach enable developers to build scalable and secure web applications effortlessly.

1. Once the ADB has been fully provisioned, return to the *Autonomous Database* page, locate the instance's display name, and then click on it to view the ADB's details page. Click the *Tools* tab.
![Navigate to the ADB's tools page.](./images/navigate-to-autonomous-database-tools-page.png)
1. Click the *Copy* button to copy the URL to launch the Oracle APEX development environment. Open the link in a new browser window or tab.
![Launch the Oracle APEX App Builder.](./images/launch-oracle-apex-app-builder.png)
1. For new ADB instances, this should launch the *Administration Services* login screen. Enter the password for the *admin* user and click the *Sign In to Administration* button.
![Login to the Oracle APEX Administration Services.](./images/login-to-oracle-apex-administration-services.png)
1. Again, for new ADB instances, after a successful login, the browser will redirect to the page shown below. Click the *Create Workspace* button.
![Click the Create Workspace button.](./images/create-a-new-workspace.png)
1. Click and select the *New Schema* option.
![Select to create a workspace using a new schema.](./images/create-workspace-using-a-new-schema.png)
1. Enter the desired *Workspace Name* and *Workspace Username*. The latter will be used to create an Oracle Database user account. Also, provide a new *Workspace Password* that conforms to the same password policy described in *Task 1*. Click the *Create Workspace* button to create the workspace.
![Provide the desired workspace name, and the administrator's username and password.](./images/provide-workspace-name-and-admin-credentials.png)
1. After the workspace has been successfully provisioned, click the button on the top-right, and then click the *Sign out* button to return to the App Builder login screen.
![Sign out of the Administration Services.](./images/sign-out-of-administration-services.png)
1. Enter the workspace name, username, and password set earlier when creating the workspace. Click the *Sign In* button to access the newly created workspace.
![Login to the new workspace.](./images/login-to-new-workspace.png)
1. After successful authentication, the browser will redirect to the default App Builder landing page where workspace administrators and developers will have access to various functionalities to develop and manage APEX applications.
![Once signed in, the workspace administrator and developers have access to the App Builder and a few other utilities.](./images/oracle-apex-development-environment-home-page.png)

## Task 9: Create a Data Science Project

1. Click the *navigation menu* button on the top left to show all the available menu items on the OCI Console, *Analytics & AI*, and then *Data Science* under the *Machine Learning* heading.
![Navigate to the data science page.](./images/navigate-to-data-science-page.png)
1. Click the *Create project* button.
![Click the create project button.](./images/create-a-new-data-science-project.png)
1. Enter the optional name and description for the project, and then click the *Create* button.
![Enter the optional name and description for the project.](./images/enter-details-about-new-data-science-project.png)

## Task 10: Create a Data Science Notebook Session

1. From the Data Science project page, click the *Create notebook session* button.
![Click the create notebook session button.](./images/create-a-new-notebook-session.png)
1. Enter 200 for the *Block storage size (in GB), and optionally, enter a meaningful name for the notebook session. Then, click the *Change shape* button in the *Compute shape* section.
![alt text](./images/modify-the-compute-shape-and-storage.png)
1. The *AMD* shape series should have already been selected. If not, select it. Select the *VM.Standard.E4.Flex* shape, and then increase the number of OCPUs to `2` or more. The amount of memory assigned would have been increased proportionately. Then click the *Select shape* button to accept the changes.
![alt text](./images/specify-desired-compute-resources.png) 
1. Scroll down the page, and in the *Network resources* section, ensure that the *Default networking* networking type, and *Public endpoint* endpoint type is selected.
![alt text](./images/configure-notebook-session-networking.png) 
1. Scroll down and leave the default, and then click the *Create* button to provision the notebook session.
![alt text](./images/create-the-notebook-session.png) 
1. The status of the notebook session should show *Active* when the instance has been successfully created. Note that once provisioned, a notebook session may be deactivated when not in use. In this state, you are not billed the fees required for the OCPUs, only the storage assigned.
![alt text](./images/notebook-session-created-successfully.png) 

You may now **proceed to the next lab**.

## Acknowledgements

* **Author** - Adrian Png, Director of Innovation, AI and Cloud Solutions, Insum Solutions Inc.
* **Last Updated By/Date** - Adrian Png, June 2024
