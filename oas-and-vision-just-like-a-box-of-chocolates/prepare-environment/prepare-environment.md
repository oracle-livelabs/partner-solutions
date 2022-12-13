# Prepare environment

## Introduction

Before you begin with the workshop, there are some prerequisites required which you might ask your OCI administrator to perform for you in case you don't have OCI and IDCS administration privileges.

In this lab you will create a new user and a user group which you will use throughout this workshop. Using a new user is optional as you can use your user account. You will also create a compartment and set some base policies that are required.

Estimated Time: 20 minutes

### Objectives

In this lab, you will:

* Create (optionally) a new user and a new group in IDCS
* Create a new group in OCI and map it to the group in IDCS
* Create a new compartment
* Set policies for the new OCI group to manage a new compartment

### Prerequisites

This lab assumes you have:

* An Oracle Cloud account with OCI and IDCS administration privileges

## Task 1: Login to OCI

1. Step 1: Enter your **Cloud Account Name**

    Go to Oracle Cloud [cloud.oracle.com](https://cloud.oracle.com). Login into OCI is a 3-step process. Provide your Cloud Account Name and click **Next**.

    ![Login screen (1)](./images/pre-lab_001.png " ")

2. Step 2: Select your **Identity Provider**

    Your tenancy might be using several Identity Providers. Choose the right one (in our example it is **oracleidentityservice**)  and click **Continue**.

    ![Login screen (2)](images/pre-lab_002.jpg =50%x*)

3. Step 3: Enter your **Credentials**.

    Enter your **username** and **password**. Click **Sign In**

    ![Login screen (3)](images/pre-lab_003.jpg =50%x*)

## Task 2: Create a new compartment

We will use one compartment for all required objects in this workshop.

In the following steps, you will create users/groups who will be assigned privileges to manage all objects in this new compartment.

NOTE: If you want to use any of existing Compartments in your OCI environment, you can use them, just pay attention when assigning privileges and creating policies.

1. Step 1: Navigate to **Compartments** page

    In OCI console, open the **Navigator** menu. Navigate to **Identity & Security** and then choose **Compartments**.

    ![Image alt text](images/pre-lab_012.png " ")

2. Step 2: Create a new compartment

    The list of all active compartments is displayed. Click **Create Compartment** to start creating a new compartment.

    ![Image alt text](images/pre-lab_013.png " ")

3. Step 3: Define compartment details

    This step is fairly straight forward. You just have to provide **Name**, **Description** and **Parent Compartment**. For better management and administration of your OCI environment you can optionally add Tags.

    Finally, click **Create Compartment**.

    ![Image alt text](images/pre-lab_014.png =50%x*)

## Task 3: (optional) Create a new user in IDCS

This task is to create a new user which will be used throughout this workshop. 

If you have your user already created (for example your user account you are logged in), then you might decide to use that user and not to create another user. In this case, this step is optional and can be skipped.

You will create a new user in **Oracle Identity Cloud Service** (and not in **OCI Console**!)

1. Step 1: Navigate to **Federation** page

    From the **Navigator** menu (top-left corner) select **Identity & Security** and then **Federation**.

    ![Image alt text](images/pre-lab_004.png " ")

2. Step 2: Choose **Identity Provider**

    Under **Federation** menu option on the left side of the page, you will see the list of all available Identity Providers. Locate and click on **OracleIdentityCloudService** link.

    ![Image alt text](images/pre-lab_005.jpg " ")

3. Step 3: Navigate to **OracleIdentityCloudService** from the **Identity Provider** page

    **OracleIdentityCloudService** page opens. Search for **Oracle Identity Cloud Service Console** link in **Identity Provider Information** tab and click on the IDCS Console URL.

    ![Image alt text](images/pre-lab_006.jpg " ")

4. Step 4: Create a new user from IDCS Console

    **Oracle Identity Cloud Service Console** opens in a new tab. To add a new user simply click on **Add a user** icon.

    ![Image alt text](images/pre-lab_007.png " ")

5. Step 5: Add a new user using **Add User** wizard

    The two-step process starts. Follow the **Add user** dialog and provide user details in the first step:

    ![Image alt text](images/pre-lab_008.jpg =50%x*)

    In our example, we created a new user with username *Candy.Sweets*. In the following second step, you will provide a *password* of your choice.

6. Check newly created user details

    You can check and verify details for the newly created user.

    ![Image alt text](images/pre-lab_009.png " ")

## Task 4: Create a new user group in IDCS

New or existing user should become a member of the **User Group** which has privileges (ie., compartment manage privileges) required later in this workshop. At this point that user group hasn't been created, so you should create one.

1. Step 1: Create a new User Group

    Stay in IDCS Console. If you skipped previous task, you will still need to perform steps 1-3 to open the IDCS Console.

    From the **IDCS Console Home Page** or from the **Navigator** menu (top-left corner) choose an option to **Create a new Group**. This is again a two-step process. In the first step provide group's **Name** and optionally **Description**. In our example, we have named our new group *Chocolates-Group*.

    ![Image alt text](images/pre-lab_010.png =50%x*)

    In the second step add users to this new group. To add a user, search for users by entering (parts of) their names in the search field and add the user to the new group - check the check-box in front of the user's name and click **Finish**.

    ![Image alt text](images/pre-lab_011.png =50%x*)

## Task 5: Create a new OCI Group and map it to an IDCS Group

In order to create policies for the compartment you've just created, you need to create a new **OCI Group**. This group will map to previously created **IDCS Group**.

1. Step 1: Navigate to **Groups** page

    Use **Navigator** to navigate again to **Identity & Security** and then choose **Groups**.

    ![Image alt text](images/pre-lab_016.png " ")

2. Step 2: Start adding a new Group

    Click **Create Group** to start creating a new group.

    ![Image alt text](images/pre-lab_017.png " ")

3. Step 3: Define a new group

    In the dialog form, provide **Name** and **Description** for the new group and click **Create**. In our example we named our group *OCI_Chocolate-Group*

    ![Image alt text](images/pre-lab_018.jpg =60%x*)

4. Step 4: Define mapping between IDCS Group and OCI Group

    You now need to map previously created **IDCS User Group** to the new **OCI Group**. This is required because all privileges, defined with policies will be created against the OCI Group. You can not assign privileges directly to IDCS User Groups.

    Navigate back to **OracleIdentityCloudService** details page.

    Observe **Resources** menu on the left side of the page. There are three links: **Users**, **Groups** and **Group Mappings**. Click on **Group Mappings** and when page is refreshed, click **Add Mappings**.

    ![Image alt text](images/pre-lab_019.png " ")

    **Add Mappings** popup window opens. Choose your IDCS User Group from **Identity Provider Group** list and your OCI Group from the **OCI Group** list.

    ![Image alt text](images/pre-lab_020.jpg =50%x*)

    Click **Add Mappings** to add a new mapping.

## Task 6: Create a new Policy

Finally, you need to create a **policy** which grants manage privileges in a new compartment to the new OCI group.

1. Step 1: Navigate to **Policies** page

    Once again use **Navigator** to navigate to **Identity & Security** and now choose **Policies**.

    ![Image alt text](images/pre-lab_021.png " ")

2. Step 2: Create a new policy

    In the **Policies** page click **Create Policy**.

    ![Image alt text](images/pre-lab_022.png " ")

3. Step 3: Define a new policy

    Provide a new Policy **Name** and **Description**.

    This policy is set at the *root* compartment level, therefore select the *root* compartment of your tenancy.

    In **Policy Builder** section, search for **Let compartment admins manage the compartment** in the **Common policy templates** pulldown list.

    Make sure **Groups** option is selected and then choose your newly created OCI Group from the list of available OCI Groups. For **Location**, select tenancy *root* compartment.

    ![Image alt text](images/pre-lab_023.png " ")

    Your policy should look like this:

     ```console
     Allow group <OCI Group> to manage all-resources in tenancy <root compartment>
     ```

4. Step 4: Finish creating a new policy

     Click **Create** to create a new policy in your *root* compartment.

     ![Image alt text](images/pre-lab_024.jpg)

     This is not the only required policy that is required for this workshop. You will return to this step to create additional policies later.

## Task 7: Logout

Once finished with prerequisite tasks, simply logout from [cloud.oracle.com](https://cloud.oracle.com) as you will (optionally) continue with your newly created user.

## Learn More

* [OCI Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)

## Acknowledgements

* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, December 2022
