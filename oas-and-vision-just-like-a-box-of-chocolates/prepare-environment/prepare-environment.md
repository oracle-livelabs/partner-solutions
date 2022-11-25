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

## Task 1: Create a new user in IDCS

1. Step 1: Log in OCI
  
    Log into [cloud.oracle.com](https://cloud.oracle.com) and priced your Cloud Account Name.

    Click **Next**.

    ![Login screen (1)](images/pre-lab_001.png =50%x)

    Choose **oracleidentityservice** as Identity Provider and click **Continue**.

    ![Login screen (2)](images/pre-lab_002.jpg)

    Enter your **username** and **password**.

    ![Login screen (3)](images/pre-lab_003.jpg)

2. Step 2: Create a new user in IDCS

    From the **Navigator** menu (top-left cornent) select **Identity & Security** and **Federation**.

    ![Image alt text](images/pre-lab_004.png)

    In the Providers list click on **OracleIdentityCloudService** link.

    ![Image alt text](images/pre-lab_005.jpg)

    **OracleIdentityCloudService** console page opens. Navigate to **Oracle Identity Cloud Service Console** by clicking on the URL.

    ![Image alt text](images/pre-lab_006.jpg)

    When **Oracle Identity Cloud Service Console** opens, click on **Add a user** icon to add a new user.

    ![Image alt text](images/pre-lab_007.png)

    Follow the **Add user** wizard and provided user details in the first step:

    ![Image alt text](images/pre-lab_008.jpg)

    We'll use user with username *Candy.Sweets* and provide a password of your choice in the second step.

    ![Image alt text](images/pre-lab_009.png)

    A new user is now created.

3. Step 3: Create a new user group in IDCS

    From the Navigator menu on the right or from Groups portlet in Identity Cloud Service Console **Create a new Group**.

    ![Image alt text](images/pre-lab_010.png)

    Search for your new user and add it to the new group.

    ![Image alt text](images/pre-lab_011.png)

4. Step 4: Create a new compartment

    From the **Navigator** menu select **Identity & Security** and **Compartments**.

    ![Image alt text](images/pre-lab_012.png)

    To create a new compartment click **Create Compartment**.

    ![Image alt text](images/pre-lab_013.png)

    Provide **Name**, **Description** and **Parent Compartment**, optionally add Tags, and click **Create Compartment**.

    ![Image alt text](images/pre-lab_014.png)

5. Step 5: Create a new OCI Group and map it to an IDCS Group

    In order to create policies for the Compartment you've just created, you need to create a new OCI Group. This group will map to previously created IDCS Group.

    Use **Navigator** to navigate again to **Identity & Security** and then choose **Groups**.

    ![Image alt text](images/pre-lab_016.png)

    Click **Create Group**

    ![Image alt text](images/pre-lab_017.png)

    Provide **Name** and **Description** and create a new group.

    ![Image alt text](images/pre-lab_018.jpg)

    Navigate back to **OracleIdentityCloudService** details page. Click on **Group Mappings** and then on **Add Mappings** button.

    ![Image alt text](images/pre-lab_019.png)

    This will open **Add Mappings** popup window. Select your new group from **Identity Provider Group** list and your newly created OCI group from the **OCI Group** list.

    ![Image alt text](images/pre-lab_020.jpg)

6. Step 6: Create a new Policy which grants manage privileges in a new Compartment to the new OCI Group

    Once again use **Navigator** to navigate to **Identity & Security** and choose **Policies**.

    ![Image alt text](images/pre-lab_021.png)

    In the Console click **Create Policy**.

    ![Image alt text](images/pre-lab_022.png)

    Provide a new Policy **Name** and **Description**.

    Select *root* compartment of your tenancy.

    In **Policy Builder** section, search for **Let compartment admins manage the compartment** in the **Common policy templates** pulldown list.

    Make sure **Groups** is selected and then choise your newly created OCI Group from the list of available OCI Groups. And choose **your root** compartment for **Location**.

    ![Image alt text](images/pre-lab_023.png)

    Your policy should look like this:

     ```
     Allow group OCI_Chocolate-Group to manage all-resources in tenancy <your root comparment>
     ```

     Click **Create** to create a new policy in your *root* compartment.

     ![Image alt text](images/pre-lab_024.jpg)

## Task 2: Logout

When you are finished with Task 1, simply logout from [cloud.oracle.com](https://cloud.oracle.com) as you will continue with your newly created user.

## Learn More

* [OCI Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)

## Acknowledgements

* **Author** - Žiga Vaupot ![Oracle ACE Pro](images/SpadeACEPro.png), Qubix Intl.
* **Contributors** -  Grega Dvoršak, Qubix Intl.
* **Last Updated By/Date** - Žiga Vaupot, November 2022
