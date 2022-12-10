# Image Library

## Introduction

This lab walks you through the steps to organize an image library in OCI Object Storage and upload X-Ray images to the the library.

Estimated Time: 20 minutes

### About OCI Object Storage
The Oracle Cloud Infrastructure Object Storage service is an internet-scale, high-performance storage platform that offers reliable and cost-efficient data durability. 

The Object Storage service can store an unlimited amount of unstructured data of any content type, including analytic data and rich content, like images and videos.

### Objectives

In this lab, you will:

* Create a new Oracle Analytics Cloud instance
* Create a staging bucket
* 
*
*

### Prerequisites

This lab assumes you have:

* An Oracle Cloud account

## Task 1: Create a new OAC instance

This lab assumes you don't have any OAC instance available at the moment. That is why you should create one. You will create one Non-Production instance with features that are available in Professional Edition. To perform this lab, you don't have to setup an OAC Enterprise Edition, but of course, you can.

1. Step 1: Navigate to **Analytics** page

    From the **Navigator** menu (top-left corner) select **Analytics & AI** and then **Analytics Cloud**.

    ![Navigate to Analytics Cloud page](./images/lab4_001.png " ")

2. Step 2: Create a new instance

    Make sure you are looking at your Compartment, in our case this is **Box-of-Chocolates** Compartment.

    ![Analytics Cloud page](./images/lab4_002.png " ")

3. Step 3: Define a new Analytics Cloud instance

    Provide a name for your new instance and optionally description. Confirm Compartment is correct.

    Then scroll down to **Capacity** section and pick one of the two options. In this case select **OCPU** as **Capacity Type** and select **OCPU Count**. **1 (Non-production)** should be enough.

    ![Create Instance step 1a/2](./images/lab4_003.png " ")

    Then scroll down again and specify **License and Edition**. As already said, **Professional Edition** should be fine as you don't need any of Enterprise Edition features.

    ![Create Instance step 1b/2](./images/lab4_004.png " ")

    Click **Create** to start provisioning your new Oracle Analytics Cloud

    ![Creating instance](./images/lab4_005.png " ")

4. Step 4: Verify that Oracle Analytics instance has been created

    It takes approx. 30 minutes to create an instance. At least this was the time which was needed in our environment.

    ![Instance created](./images/lab4_006.png " ")

    Instance should be in **Active** state.

## Task 2: Set visibility

In order to make your image library visible to other users/service, you have to update its visibility. One way of doing it is to set visibility to **Public**.

1. Step 1: Change visibility to Public.

    From your bucket list choose your newly created bucket.

    ![Buckets List](./images/lab1_007.jpg " ")

2. Step 2: Edit Visibility

    In the Bucket Details page, click **Edit Visibility**.

    ![Bucket Details Page](./images/lab1_008.jpg " ")

3. Step 3: Update Visibility

    Check **Public** radio button and click **Save Changes**

    ![Update visibility](./images/lab1_009.jpg =50%x*)

4. Step 4: (optional) Set Pre-Authenticated Request

    Please note that you have an option to set **Pre-Authentication Request** instead of changing visibility to **Public**.

    In this case click **Pre-Authentication Requests** link under **Resources** and then **Create Pre-Authenticated Request**.

    ![PAR](./images/lab1_010.png " ")

    Fill required field in PAR definition and finally click **Create Pre-Authenticated Request**.

    ![Create PAR](./images/lab1_011.png " ")

    Pre-Authenticated Request details popup window is shown. Please copy URL for your reference as it won't be shown again.

    ![PAR URL](./images/lab1_012.png " ")

    Click **Close** to return to the **Bucket Details** page.

    ![Bucket Details Page](./images/lab1_013.png " ")

## Task 3: Set required folder structure

This workshop is using [Chest X-Ray Images (Pneumonia)](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia) dataset.

In this task you will setup the folder structure and load images into proper folders in the next. 

Start with the library folder structure. Image library is organized in two folders:

* PNEUMONIA, which contains images of bacteria or virus infected lungs, and
* NORMAL, which contains images of normal, unaffected lungs

1. Step 1: Create a new folder

    Make sure you've clicked **Objects** under **Resources** in the Bucket Details page of you new bucket. 

    Click **More Actions** and choose **Create New Folder** from the menu.
    
    ![Create folder](./images/lab1_014.png " ")

2. Step 2: Define folder

    Name your new folder **PNEUMONIA** and click **Create**

    ![Pneumonia folder](./images/lab1_015.jpg " ")

    Repeat this step for another new folder **NORMAL**.
    
    ![Normal folder](./images/lab1_016.png " ")

3. Step 3: Verify your folder structure

    Please verify that you've created two folders, PNEUMONIA and NORMAL, under the *root*.

    ![Verify folders](./images/lab1_017.jpg " ")

## Task 4: Load images

We are now ready to load images into appropriate folders. The following steps might seem a bit long and far from being optimal as all images will be loaded using **Upload** utility provided on **Bucket Details** page. More elegant way of uploading would be to upload programmatically. 

The main issue with **Upload** is that you can only load approx. 200 images in one attempt. This means repeating the upload step several times to upload all 5000 images. This step can take approx 20-30 minutes to complete.

1. Step 1: Initiate images Upload

    You should still be located in the **Objects** sub-page of the **Bucket Details** page of your bucket.

    Navigate to the **PNEUMONIA** folder first.

    ![Pneumonia folder](./images/lab1_018.png " ")

    And click **Upload**.

2. Step 2: Upload images for PNEUMONIA

    In the dialog window leave **Object Name Prefix** empty, and leave **Storage Tier** unchanged.

    Then **drag image files** or **select files** from your computer onto **Choose Files from your Computer Area**. When ready, **Upload** button will become enabled (blue). Please note that you can upload approx. 200 images in one upload job.

    Click **Upload** and wait all images are uploaded.

    ![Upload pneumonia images](./images/lab1_019.png " ")

    Repeat this step for all 3000+ images for PNEUMONIA.

3. Step 3: Upload images for NORMAL

    Repeat the previous step, except this time navigate to NORMAL folder and upload images for NORMAL.

    ![Upload normal images](./images/lab1_020.png " ")

    There should be approx. 1000+ images for NORMAL.

4. Step 4: Verify images are correctly loaded

    Before you continue to the next lab, just make sure that you've uploaded all images and that images are correctly placed into PNEUMONIA and NORMAL folders:

    ![Verify loaded images](./images/lab1_022.png " ")

    You should see and review all details of uploaded images in corresponding folders.

    ![Verify loaded images](./images/lab1_021.png " ")

## Learn More

* [OCI Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/home.htm)


## Acknowledgements
* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, November 2022