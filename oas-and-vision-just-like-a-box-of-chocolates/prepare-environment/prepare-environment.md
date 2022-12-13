# Prepare environment

## Introduction

In this lab you will create a new user and a user group which you will use in this workshop. You will also create a compartment and set some base policies that are required.

Estimated Time: 15 minutes

### Objectives

In this lab, you will:

* Create a new user and a new group in IDCS
* Create a new group in OCI and map it to the group in IDCS
* Create a new compartment
* Set policies for the new OCI group to manage a new compartment

### Prerequisites

This lab assumes you have:

* An Oracle Cloud account with administration privileges

## Task 1: Login to OCI

1. Step 1: Enter your **Cloud Account Name**

    Go to Oracle Cloud [cloud.oracle.com](https://cloud.oracle.com). Login into OCI is a 3-step process. Provide your Cloud Account Name and click **Next**.

    ![Login screen (1)](./images/pre-lab_001.png " ")

2. Step 2: Select your **Identity Provider**

    You might have several Identity Providers. Choose the correct one (in our example it is **oracleidentityservice**)  and click **Continue**.

    ![Login screen (2)](images/pre-lab_002.jpg =50%x*)

3. Step 3: Enter your **Credentials**.

    Enter your **username** and **password**.

    In the following steps, a new user, a new user group, a new compartment and some new policies will be created. That is why you need OCI administrator privileges. If these are not given, please consult your OCI Administrator to perform steps below for you.

    ![Login screen (3)](images/pre-lab_003.jpg =50%x*)

## Task 2: Create a new user in IDCS

All labs can be performed by a user who has OCI Administrators privileges. If you don't have these privileges, then you'll have to ask your OCI Administrator to perform the following tasks for you.

The first task is to create a new user which will be used throughout this workshop. If you have your user already created, then you might decide to use that user and a new user is not required. In this case, the first step can simply be skipped.

A new user will be opened using **Oracle Identity Cloud Service**.

1. Step 1: Navigate to **Federation** page

    From the **Navigator** menu (top-left cornent) select **Identity & Security** and **Federation**.

    ![Image alt text](images/pre-lab_004.png " ")

2. Step 2: Choose **Identity Provider**

    Under **Federation**, you will see the list of all available Identity Providers. Select and click on **OracleIdentityCloudService** link.

    ![Image alt text](images/pre-lab_005.jpg " ")

3. Step 3: Navigate to **OracleIdentityCloudService** from the **Identity Provider** page

    **OracleIdentityCloudService** page opens. Navigate to **Oracle Identity Cloud Service Console** by clicking on the URL.

    ![Image alt text](images/pre-lab_006.jpg " ")

4. Step 4: Create a new user from IDCS Console

    When **Oracle Identity Cloud Service Console** opens in a new tab, click on **Add a user** icon to add a new user.

    ![Image alt text](images/pre-lab_007.png " ")

5. Step 5: Add a new user using **Add User** wizard

    Follow the **Add user** wizard and provide user details in the first step:

    ![Image alt text](images/pre-lab_008.jpg =50%x*)

    We'll use user with username *Candy.Sweets*. In the 2nd step, provide a password of your choice.

6. Check newly created user details

    You can check and verify details for the newly created user.

    ![Image alt text](images/pre-lab_009.png " ")

## Task 3: Create a new user group in IDCS

New or existing user should become a member of the **User Group** which will have privileges (ie., compartment manage privileges) required later in this workshop.

1. Step 1: Create a new User Group

    Stay in IDCS Console.

    From the IDCS Console Home Page or from the Navigator menu (top-left corner) choose an option to  **Create a new Group**. This is again 2-step process. In the first step provide a new User Group a name an optionally Description. We will name our new group Chocolates-Group.

    ![Image alt text](images/pre-lab_010.png =50%x*)

    In the second step add users to the new group. To add your user, search for your users in search field and add the user to the new group.

    ![Image alt text](images/pre-lab_011.png =50%x*)

## Task 4: Create a new compartment

We will use one compartment for all required objects in this workshop. In the following steps, we will create a new OCI group (mapped to newly created User Group in IDCS, which will have privileges to manage all objects in this new compartment. Of course this step is optional if you want to use any of existing Compartments in your OCI environment.

1. Step 1: Navigate to **Compartments** page

    In OCI console, select **Identity & Security** and **Compartments** from the **Navigator** menu.

    ![Image alt text](images/pre-lab_012.png " ")

2. Step 2: Create a new compartment

    The list of all compartments is displayed. Click **Create Compartment** to start creating a new compartment. 

    ![Image alt text](images/pre-lab_013.png " ")

3. Step 3: Define compartment details

    Provide **Name**, **Description** and **Parent Compartment**, optionally add Tags.

    Finally, click **Create Compartment**.

    ![Image alt text](images/pre-lab_014.png =50%x*)

## Task 5: Create a new OCI Group and map it to an IDCS Group

In order to create policies for the Compartment you've just created, you need to create a new OCI Group. This group will map to previously created IDCS Group.

1. Step 1: Navigate to **Groups** page

    Use **Navigator** to navigate again to **Identity & Security** and then choose **Groups**.

    ![Image alt text](images/pre-lab_016.png " ")

2. Step 2: Start adding a new Group

    Click **Create Group** to create a new group.

    ![Image alt text](images/pre-lab_017.png " ")

3. Step 3: Define a new group

    Provide **Name** and **Description** and create a new group.

    ![Image alt text](images/pre-lab_018.jpg =60%x*)

4. Step 4: Define mapping between IDCS Group and OCI Group

    You now need to map previously created User Group from IDCS to the new Group, you've just created in OCI. This is required because all privileges, defined with Policies will be create against the OCI Group. You can not assign privileges directly to User Groups in IDCS.

    Navigate back to **OracleIdentityCloudService** details page.

    Observe **Resources** menu on the left side of the page. There are three links: Users, Groups and Group Mappings. Click on **Group Mappings** and when page is refreshed, click **Add Mappings**.

    ![Image alt text](images/pre-lab_019.png " ")

    **Add Mappings** popup window opens. Choose your IDCS Group from **Identity Provider Group** list and your OCI Group from the **OCI Group** list.

    ![Image alt text](images/pre-lab_020.jpg =50%x*)

    Click **Add Mappings** to add a new mapping.

## Task 6: Create a new Policy

Finally, you need to create a policy which grants manage privileges in a new Compartment to the new OCI Group.

1. Step 1: Navigate to **Policies** page

    Once again use **Navigator** to navigate to **Identity & Security** and choose **Policies**.

    ![Image alt text](images/pre-lab_021.png " ")

2. Step 2: In the **Policies** page click **Create Policy**.

    ![Image alt text](images/pre-lab_022.png " ")

3. Step 3: Define a new policy

    Provide a new Policy **Name** and **Description**.

    This policy is set on the *root* level, therefore select your **root** compartment of your tenancy.

    In **Policy Builder** section, search for **Let compartment admins manage the compartment** in the **Common policy templates** pulldown list.

    Make sure **Groups** is selected and then choise your newly created OCI Group from the list of available OCI Groups. And choose **your root** compartment for **Location**.

    ![Image alt text](images/pre-lab_023.png " ")

    Your policy should look like this:

     ```
     Allow group <OCI Group> to manage all-resources in tenancy <your root comparment>
     ```
4. Step 4: Create

     Click **Create** to create a new policy in your *root* compartment.

     ![Image alt text](images/pre-lab_024.jpg)

     This is not the only required policy that is required for this workshop. You will return to this step to create additional policies.

## Task 7: Logout

Once finished with previous tasks, simply logout from [cloud.oracle.com](https://cloud.oracle.com) as you will continue with your newly created user.

## Learn More

* [OCI Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)

## Acknowledgements

* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, November 2022
