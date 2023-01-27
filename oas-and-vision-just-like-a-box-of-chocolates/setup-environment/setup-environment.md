# Workshop setup

## Introduction

Oracle Analytics and OCI Vision: Just like a Box of Chocolates workshop is using various OCI services, such as Object Storage, Data Labeling, Vision and Analytics Cloud.

There are several assumptions based on which this workshop is prepared. These assumptions are:

* Starting point for this workshop is your own tenancy.
* You will create all services from scratch. If you have more experience working with OCI, you can adopt some of the scripts to use instances/resources already in use.
* If your user has OCI and IDCS administration privileges, then you can use that user to perform environment preparation (Get Started) steps, otherwise you should ask you OCI Administrator to perform those steps for you.

In this lab you will create a new compartment where you will create all of your objects used in this workshop. You will also create a new user which will have privileges to manage all resources in the new compartment. Additionally, you will set policies which will enable you to run data labeling and vision model creation.

When finished, you will login as a newly created user and continue with the labs.

Estimated Time: 60 minutes incl. images download

### Objectives

In this lab, you will:

* Download images
* Create a new compartment for objects used in workshop
* Create (optionally) a new user and a new group in IDCS
* Create a new group in OCI and map it to the group in IDCS
* Set policies for the new OCI group to manage a new compartment
* Create a new Dynamic Group and required Policies for Data Labeling
* Create new Policies for AI Vision Service
* Create a new Policy for Cloud Shall access

### Prerequisites

This lab assumes:

* You have an Oracle Cloud account with OCI and IDCS administration privileges or
* Your OCI and IDCS administrator can perform steps in this lab for you.

## Task1: Download and extract images

1. Download images

    Go to [https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia) and download image files (one zipped file will be downloaded). To do this, you will most likely be asked to register as a new Kaggle users

2. Extract images from downloaded zip file

    Extract downloaded zip file to you local files system. You will use images from **Train** and **Validate** folders in this workshop.

## Task 2: Log into OCI

1. Login into OCI

    To setup environment, you need OCI Administrators privileges. If you've got these privileges, login into OCI as described in the instructions in previous, **Get started**, lab.

    In case you haven't got OCI Admistrators privileges, you should ask your OCI administrator to perform the rest of the tasks in this lab.

## Task 3: Create a new compartment

You will use one compartment for all required objects in this workshop, hence you need to create one.

1. Navigate to Compartments page

    In OCI console, open the **Navigator** menu. Navigate to **Identity & Security** and then choose **Compartments**.

    ![Navigate to Compartments](https://oracle-livelabs.github.io/common/images/console/id-compartment.png " ")

2. Create a new compartment

    The list of all active compartments is displayed. Click **Create Compartment** to start creating a new compartment.

    ![Create a new Compartment](./images/create-a-new-compartment.png " ")

3. Define compartment details

    This step is fairly straight forward. You just have to provide **Name**, **Description** and **Parent Compartment**. Since we started to talk about OCI like a box of chocolates, we have named our compartment Box-of-Chocolates.

    Additionally, for better management and administration of your OCI environment you can optionally add Tags.

    Finally, click **Create Compartment**. 

    ![Define a new Compartment](./images/define-a-new-compartment.png =50%x*)

## Task 4: (optional) Create a new user in IDCS

In this task you will create a new user which will be used throughout this workshop.

This step is optional, if you would like to use any other existing user (for example, your user account you normally log into Oracle Cloud). Then you might decide to use that user and not to create another user. In this case, this step is optional and can be skipped.

You will create a new user in **Oracle Identity Cloud Service** (and not in **OCI Console**!)

1. Navigate to Federation page

    From the **Navigator** menu (top-left corner) select **Identity & Security** and then **Federation**.

    ![Navigate to Federation](https://oracle-livelabs.github.io/common/images/console/id-federation.png " ")

2. Choose identity provider

    **Federation** page is displayed. You will see the list of all available Identity Providers.

    Locate and click on **OracleIdentityCloudService**.

    ![Open OracleIdentityCloudService](./images/open-oracleidentitycloudservice.jpg " ")

3. Navigate to OracleIdentityCloudService from the Identity Provider page

    **OracleIdentityCloudService** page opens. Search for **Oracle Identity Cloud Service Console** link in **Identity Provider Information** tab and click on the IDCS Console URL.

    ![Click on IDCS Console URL](./images/click-idcs-console-url.jpg " ")

4. Create a new user from IDCS console

    **Oracle Identity Cloud Service Console** opens in a new tab.

    To add a new user simply click on **Add a user** icon.

    ![Add a new user in IDCS](./images/add-user-in-idcs.png " ")

5. Add a new user using Add User wizard

    Follow the two-step **Add user** dialog and provide user details in the first step. Make sure that you provide **your own email address** to receive Welcome email to activate the user.

    ![Define a new user](./images/define-a-new-user.jpg =50%x*)

    In example above, a new user with username *Candy.Sweets* is created. In the second step, you should assign a new user to groups. However, this step is optional as there is no group at the moment you can assign new user to. So simply ignore it and click **Finish**.

6. Check newly created user's details

    You can check and verify details for the newly created user.

    ![Verify user information](./images/verify-user-information.png " ")

7. Activate user

    You should also check your inbox for the Welcome email. Once received, follow the links from email and activate your new user.

    ![A new user Welcome e-mail](./images/welcome-email.png =50%x*)

## Task 5: Create a new user group in IDCS

Your new or existing user should become a member of the **User Group** which will be assigned privileges (ie., compartment manage privileges) required to use services in this workshop. At this point that user group hasn't been created, so you should create one.

1. Create a new group in IDCS

    Stay in IDCS console. If you skipped previous task, you will still need to perform steps 1-3 to navigate to the IDCS console.

    From the **IDCS Console Home Page** or from the **Navigator** menu (top-left corner) choose an option to **Create a new Group**.

    This is again a two-step process. In the first step provide group's **Name** and optionally **Description**. In our example, user group is named  *Chocolates-Group*.

    ![Define a new User Group](./images/define-user-group.png =50%x*)

    In the second step add your user to this new group. To add a user, search for users by entering (parts of) their names in the search field and add the user to the new group - check the check-box in front of the user's name and click **Finish**.

    ![Assign users to the new group](./images/assign-users-to-group.png =50%x*)

## Task 6: Create a new OCI group and map it to an IDCS group

Next step is to create a new OCI group and map it to the IDCS group you've just created. This step is required because you can't create policies, needed for example to create dataset for data labeling, for IDCS groups, but for OCI groups. Hence a new OCI group has to be created and mapped to IDCS group.

1. Navigate to OCI Groups page

    Use **Navigator** to navigate again to **Identity & Security** and then choose **Groups**.

    ![Navigate to OCI Groups](./images/navigate-to-oci-groups.png " ")

2. Start adding a new OCI group

    Click **Create Group** to start creating a new group.

    ![Create a new OCI Group](./images/create-a-new-oci-group.png " ")

3. Define a new OCI group

    In the dialog form, provide **Name** and **Description** for the new group and click **Create**. In example below, group is called *OCI_Chocolate-Group*.

    ![Define a new OCI Group](./images/define-oci-group.jpg =60%x*)

4. Define mapping between IDCS group and OCI group

    Now, you need to map previously created **IDCS Group** to the new **OCI Group**. This is required because all privileges, defined with policies will be created against the OCI Group. You can not assign privileges directly to IDCS Groups.

    Navigate back to **OracleIdentityCloudService** details page:

    * Navigate first to **Identity** and then to **Federation**.
    * From **Federation** page click **OracleIdentityCloudService** link to open **OracleIdentityCloudService** page.

    Observe **Resources** menu on the left side of the page. There are three links: **Users**, **Groups** and **Group Mappings**. Click on **Group Mappings** and when page is refreshed, click **Add Mappings**.

    ![Group mappings](./images/group-mappings.png " ")

    **Add Mappings** popup window opens. Choose your IDCS Group from **Identity Provider Group** list and your OCI Group from the **OCI Group** list.

    ![Add a new IDCS - OCI Group mapping](./images/add-group-mapping.jpg =50%x*)

    Click **Add Mappings** to add a new mapping.

## Task 7: Create a new policy for compartment management

Finally, you need to create a **policy** which grants manage privileges in a new compartment to the new OCI group.

1. Navigate to **Policies** page

    Once again use **Navigator** to navigate to **Identity & Security** and now choose **Policies**.

    ![Navigate to Policies](https://oracle-livelabs.github.io/common/images/console/id-policies.png " ")

2. Create a new policy

    In the **Policies** page click **Create Policy**.

    ![Create a new policy](./images/create-a-new-policy.png =30%x*)

3. Define a new policy

    Provide a new Policy **Name** and **Description**.

    This policy is set at the *root* compartment level, therefore select the *root* compartment of your tenancy.

    In **Policy Builder** section, search for **Let compartment admins manage the compartment** in the **Common policy templates** pulldown list.

    Make sure **Groups** option is selected and then choose your newly created OCI Group from the list of available OCI Groups. For **Location**, select tenancy *root* compartment.

    ![Policy for compartment admins to manage the compartment](./images/policy-for-compartment-admins.png " ")

    Your policy should look like this:

     ```text
     <copy>Allow group <OCI Group> to manage all-resources in tenancy</copy>
     ```

4. Finish creating a new policy

     Click **Create** to create a new policy in your *root* compartment.

     ![Verify policy for compartment admins to manage the compartment](./images/verify-policy-for-compartment-admins.jpg)

     This is not the only required policy that is required for this workshop. You will return to this step to create additional policies later.

## Task 8: Create a new dynamic group and policies for Data Labeling

One of the tasks in this workshop will be data labeling. This is a process in which all images from your training image library will be assigned a single label that describe that specific image.  To be able to perform your data labeling process, you must perform the following prerequisite steps to:

* create one new dynamic group and
* set required policies for data labeling

To find out which steps you need to perform, you can navigate to **Data Labeling** page. You will find detailed instructions there.

1. (optional) Navigate to dData Labeling page

    From the **Navigator** menu select **Analytics & AI** and then **Data Labeling**.

    ![Navigate to Data Labeling](./images/navigate-to-data-labeling.png " ")

2. (optional) Open Datasets sub-page

    Click on **Datasets** link under **Data Labeling** on the left side of the page. This will open **Dataset list** page in selected Compartment (you might need to change compartment to the one you've created for this workshop).

    ![Open Datasets page](./images/open-datasets-page.png " ")

3. (optional) Verify data labeling prerequisites

    Expand **Show more information** to display what prerequisites have to be met before you can start your data labeling exercise. If these are not met, then Data Labeling might not run properly.

    ![Show more information for Data Labeling](./images/show-more-for-data-labeling.png " ")

    You have already created a new OCI group, hence creating a new OCI group is not needed. Continue with creating a new dynamic group.

4. Navigate to Dynamic Groups page

    From **Navigator** menu choose **Identity & Security** and then **Dynamic Groups**.

    ![Navigate to Dynamic Groups](./images/navigate-to-dynamic-groups.png " ")

5. Create a new dynamic group

    Click **Create** and define a new **Dynamic Group**.

    Provide **Name**, **Description** and enter the following statement to the **Matching Rules**:

    ```text
    <copy>ALL { resource.type = 'datalabelingdataset' }</copy>
    ```

    ![Define dynamic group for data labeling](./images/define-dynamic-group-for-data-labeling.png " ")

6. Verify your new dynamic group

    Verify that your **Dynamic Group** is properly defined.

    ![Verify dynamic group for data labeling](./images/verify-dynamic-group-for-data-labeling.png " ")

7. Set policies for data labeling

    From the **Navigator** menu select **Identity & Security** and then choose **Policies**.

    ![Navigate to policies](https://oracle-livelabs.github.io/common/images/console/id-policies.png " ")

8. Create a new policy for non-administrative users

    Make sure that you've selected your *root* compartment first. Then click **Create Policy**.

    The first policy is for Non-Administrative users. These users are members of previously created OCI Group.

    OCI Group needs the following privileges (assuming OCI Group is called *OCI_Chocolate-Group* and compartment's name is *Box-of-Chocolates*):

    ```text
    <copy>allow group OCI_Chocolate-Group to read buckets in compartment Box-of-Chocolates
    allow group OCI_Chocolate-Group to manage objects in compartment Box-of-Chocolates
    allow group OCI_Chocolate-Group to read objectstorage-namespaces in compartment Box-of-Chocolates
    allow group OCI_Chocolate-Group to manage data-labeling-family in compartment Box-of-Chocolates</copy>
    ```

    ![Define data labeling policy for non-administrative users](./images/define-policy-for-non-admin-users.png " ")

    Verify and double check all policies statements are properly entered and click **Create**.

    ![Verify data labeling policy for non-administrative users](./images/verify-policy-for-non-admin-user.png " ")

9. Create a new policy for dynamic group

    Repeat **Create Policy** for Dynamic Group you've created in the previous step.

    Enter the following statements (again assuming Dynamic Group is called *Box-of-Chocolates_DataLabeling* and compartment's name is *Box-of-Chocolates*):

    ```text
    <copy>allow dynamic-group Box-of-Chocolates_DataLabeling to read buckets in compartment Box-of-Chocolates
    allow dynamic-group Box-of-Chocolates_DataLabeling to read objects in compartment Box-of-Chocolates
    allow dynamic-group Box-of-Chocolates_DataLabeling to manage objects in compartment Box-of-Chocolates where any {request.permission='OBJECT_CREATE'}</copy>
    ```

    ![Define data labeling policy for Dynamic Groups](./images/define-policy-for-dynamic-groups.png " ")

    Verify and double check all policies statements are properly entered and click **Create**.

    ![Verify data labeling policy for Dynamic Groups](./images/verify-policy-for-dynamic-groups.png " ")

    You are now ready to start using Data Labeling service.

## Task 9: Create new policies for OCI Vision service

Similarly to Data Labeling service, you will require some privileges to use OCI Vision service. 

1. (optional) Navigate to Vision page

    Using **Navigator** (on the left) navigate to **Analytics & AI** and then choose **Vision**.

    ![Navigate to Vision](./images/navigate-to-vision.png " ")

2. (optional) Go to custom Projects sub-page

    You will see a menu of Vision options on the left side of the page. As you can see **Vision** service can be used for **Image Classification**, **Object Recognition** and **Document AI**. These services are ready to use services, so you can try them without any preparation.

    In your case, you will create your own custom model. So, Click **Projects**

    ![Go to Projects](./images/go-to-projects.png " ")

3. (optional) Review important information about custom projects

    When you open the **Projects** page, pay attention to **important information** note that is displayed at the top of the page. There are some policies required which need to be set before you create a new custom project and before you start training your models.

    ![Review Important Information](./images/review-important-information.png " ")

4. Set policies for Vision

    From the **Navigator** menu select **Identity & Security** and then choose **Policies**.

    ![Navigate to policies](https://oracle-livelabs.github.io/common/images/console/id-policies.png " ")

5. Create a new policy

    Click **Create Policy**.

    ![Navigate to Vision](./images/create-a-new-policy.png =30%x*)

6. Define policies to access Vision service

    Provide a name of a new policy and description in **Create Policy** dialog page. In the **Policy Builder** section enable **Show manual editor** and enter the following policy:

    ```text
    <copy>allow group <OCI Group> to manage ai-service-vision-family in tenancy</copy>
    ```

    ![Define a new policy for Vision](./images/define-a-new-policy-for-vision.png " ")

    Click **Create**.

7. Confirm Policy

    Wait until policy is created and verify it has been properly set.

    ![Verify a new policy for Vision](./images/verify-a-new-policy-for-vision.png " ")

## Task 10: Create a Policy to grant access to Cloud Shell

1. Navigate to Policies page

    Once again, from the **Navigator** menu select **Identity & Security** and then choose **Policies**.

    ![Navigate to policies](https://oracle-livelabs.github.io/common/images/console/id-policies.png " ")

2. Create a new policy that grants access to Cloud Shell

    Enable **Show manual editor** in **Policy Builder** area and enter the following policy statement:

    ```text
    <copy>allow group <OCI Group> to use cloud-shell in tenancy</copy>
    ```

    ![Create a policy to grant access to Cloud Shell](./images/create-new-policy-for-cloud-shell.png " ")

    Click **Create**.

3. Verify created policy

    Verify entered policy.

    ![Verify a policy to grant access to Cloud Shell](./images/verify-new-policy-for-cloud-shell.png " ")

## Task 11: Logout

Once finished with prerequisite tasks, simply logout from [cloud.oracle.com](https://cloud.oracle.com) as you will (optionally) continue with your newly created user.

You can now **proceed to the next lab**.

## Learn More

* [OCI Documentation](https://docs.oracle.com/en-us/iaas/Content/home.htm)

## Acknowledgements

* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, December 2022
