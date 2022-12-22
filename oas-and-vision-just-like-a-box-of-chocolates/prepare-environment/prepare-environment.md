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
* Create a new Dynamic Group and required Policies for  Data Labeling
* Create new Policies for AI Vision Service
* Create a new Policy for Cloud Shall access

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

    **Federation** page is displayed. You will see the list of all available Identity Providers.
    
    Locate and click on **OracleIdentityCloudService** link.

    ![Image alt text](images/pre-lab_005.jpg " ")

3. Step 3: Navigate to **OracleIdentityCloudService** from the **Identity Provider** page

    **OracleIdentityCloudService** page opens. Search for **Oracle Identity Cloud Service Console** link in **Identity Provider Information** tab and click on the IDCS Console URL.

    ![Image alt text](images/pre-lab_006.jpg " ")

4. Step 4: Create a new user from IDCS Console

    **Oracle Identity Cloud Service Console** opens in a new tab. To add a new user simply click on **Add a user** icon.

    ![Image alt text](images/pre-lab_007.png " ")

5. Step 5: Add a new user using **Add User** wizard

    The two-step process starts. Follow the **Add user** dialog and provide user details in the first step. Provide your own email address to receive Welcome email to activate the user.

    ![Image alt text](images/pre-lab_008.jpg =50%x*)

    In example above, a new user with username *Candy.Sweets* is created. In the following second step, you should assign a new user to groups. However, this step is optional as there is no group you can assign to. So simply click **Finish**.

6. Check newly created user details

    You can check and verify details for the newly created user.

    ![Image alt text](images/pre-lab_009.png " ")

    You should also check your inbox for the Welcome email. Once received, follow the links from email and activate your new user.

    ![Image alt text](images/pre-lab_009-2.png =50%x*)

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

    Navigate back to **OracleIdentityCloudService** details page: 
    
    * Navigate first to **Identity** and then to **Federation**. 
    * From **Federation** page click **OracleIdentityCloudService** link to open **OracleIdentityCloudService** page.

    Observe **Resources** menu on the left side of the page. There are three links: **Users**, **Groups** and **Group Mappings**. Click on **Group Mappings** and when page is refreshed, click **Add Mappings**.

    ![Image alt text](images/pre-lab_019.png " ")

    **Add Mappings** popup window opens. Choose your IDCS User Group from **Identity Provider Group** list and your OCI Group from the **OCI Group** list.

    ![Image alt text](images/pre-lab_020.jpg =50%x*)

    Click **Add Mappings** to add a new mapping.

## Task 6: Create a new Policy for Compartment management

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

## Task 7: Create a Dynamic Group and Policies for Data Labeling

Before you can start your data labeling process, you must perform prerequisete steps to:

* set additional dynamic group and
* to set some required policies for your existing OCI Group and for the new Dynamic Group.

To find out which dynamic groups and policies are required navigate to **Data Labeling** page as follows:

1. Step 1: Navigate to **Data Labeling** page

    From the **Navigator** menu select **Analytics & AI** and then **Data Labeling**.

    ![](./images/lab2_001.png " ")

2. Step 2: Create a new Dataset

    Click on **Datasets** link under **Data Labeling** on the left side of the page. This will open **Dataset list** page in selected Compartment (you might change Compartment to Compartment you've created for this workshop).

    ![](./images/lab2_002.png " ")

3. Step 3: Verify **Data Labeling Prerequisites**

    Expand **Show more information** to display what prerequisites have to be met before you can start your data labeling exercise. If these are not met, then Data Labeling might not run properly.

    ![](./images/lab2_004.png " ")

    In *Step 1)*, you can use OCI Group you've created earlier, so you can skip the *Step 1)* and continue with creating a new Dynamic Group.

4. Step 4: Navigate to **Dynamic Groups** page

    From **Navigator** menu choose **Identity & Security** and then **Dynamic Groups**.

     ![](./images/lab2_005.png " ")

5. Step 5: Create a new **Dynamic Group**

    Click **Create** and define a new **Dynamic Group**.

    Provide **Name**, **Description** and enter the following statement to the **Matching Rules**:

    ```console
    ALL { resource.type = 'datalabelingdataset' }
    ```

    ![](./images/lab2_006.png " ")

6. Step 6: Verify your new **Dynamic Group**

    Verify that your **Dynamic Group** is properly defined.

    ![](./images/lab2_007.png " ")

7. Step 7: Set policies for **Data Labeling**

    From the **Navigator** menu select **Identity & Security** and then choose **Policies**.

    ![](./images/lab2_008.png " ")

8. Step 8: Create a new policy for **Non-Administrative users**

    Make sure that you've selected your *root* compartment first. Then click **Create Policy**.

    The first policy is for Non-Administrative users. These are members of previously created OCI Group.

    OCI Group needs the following privileges (assuming OCI Group is called *OCI_Chocolate-Group* and compartment's name is *Box-of-Chocolates*):

    ```console
    allow group OCI_Chocolate-Group to read buckets in compartment Box-of-Chocolates
    allow group OCI_Chocolate-Group to manage objects in compartment Box-of-Chocolates
    allow group OCI_Chocolate-Group to read objectstorage-namespaces in compartment Box-of-Chocolates
    allow group OCI_Chocolate-Group to manage data-labeling-family in compartment Box-of-Chocolates
    ```

    ![](./images/lab2_010.png " ")

    Verify and double check all policies statements are properly entered and click **Create**.

    ![](./images/lab2_011.png " ")

9. Step 9: Create a new policy for Dynamic Group

    Repeat **Create Policy** for Dynamic Group you've created in the previous step. 

    Enter the following statements (again assuming Dynamic Group is called *Box-of-Chocolates_DataLabeling* and compartment's name is *Box-of-Chocolates*):

    ```console
    allow dynamic-group Box-of-Chocolates_DataLabeling to read buckets in compartment Box-of-Chocolates
    allow dynamic-group Box-of-Chocolates_DataLabeling to read objects in compartment Box-of-Chocolates
    allow dynamic-group Box-of-Chocolates_DataLabeling to manage objects in compartment Box-of-Chocolates where any {request.permission='OBJECT_CREATE'}
    ```

    ![](./images/lab2_012.png " ")

    Verify and double check all policies statements are properly entered and click **Create**.

    ![](./images/lab2_013.png " ")

    You are now ready to start with Data Labeling.

## Task 8: Create new Policies for AI Vision Service

1. Step 1: Navigate to **Vision**

    Using **Navigator** (on the left) navigate to **Analytics & AI** and then choose **Vision**.

    ![Navigate to Vision](./images/lab3_001.png " ")

2. Step 2: Create a custom **Project**

    You will see a menu of Vision options on the left side of the page. As you can see **Vision** service can be used for **Image Classification**, **Object Recognition** and **Document AI**. These there services are ready to use services, so you can try them without any preparation.

    In your case, you will create your own custom model. So, Click **Projects**

    ![Navigate to Vision](./images/lab3_002.png " ")

3. Step 3: Projects

    When you open the **Projects** page, pay attention to **important information** note that is displayed at the top of the page. There are some policies required which need to be set before you create a new custom project and before you start training your models.

    ![Navigate to Vision](./images/lab3_003.png " ")

4. Step 4: Setting policies for Vision

    If you haven't set policies for Vision before, then open a new browser tab and navigate to **Policies** page.

    ![Navigate to Vision](./images/lab3_004.png =50%x*)

5. Step 5: Create a new policy

    Click **Create Policy**.

    ![Navigate to Vision](./images/lab3_005.png =30%x*)

6. Step 6: Define policies to access Vision service

    Provide a name of a new policy and description in **Create Policy** dialog page. In the **Policy Builder** section enable **Show manual editor** and enter the following policy

    ```console
    allow group OCI_Chocolate-Group to manage ai-service-vision-family in tenancy
    ```

    ![Navigate to Vision](./images/lab3_006.png " ")

    Click **Create**.

7. Step 7: Confirm Policy

    Wait till policy is created and verify it has been properly set.

    ![Navigate to Vision](./images/lab3_007.png " ")

    You can close your 2nd tab page now.

## Task 9: Create a Policy to grant access to Cloud Shell

1. Step 1: TO DO TO DO TO DO

    ```console
    allow group OCI-Box_Group to use cloud-shell in tenancy

    ```

## Task 10: Logout

Once finished with prerequisite tasks, simply logout from [cloud.oracle.com](https://cloud.oracle.com) as you will (optionally) continue with your newly created user.

## Learn More

* [OCI Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)

## Acknowledgements

* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, December 2022
