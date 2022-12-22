# Data (Image) Labaling

## Introduction

This lab walks you through the steps to create a new dataset of records using images from your image library and to label those images with one of two labels: PNEUMONIA and NORMAL.

Estimated Time: 60 minutes

### About Data Labeling

Oracle Cloud Infrastructure (OCI) Data Labeling is a service for building labeled datasets to more accurately train AI and machine learning models. With OCI Data Labeling, developers and data scientists assemble data, create and browse datasets, and apply labels to data records through user interfaces and public APIs. The labeled datasets can be exported for model development across Oracle’s AI and data science services for a seamless model-building experience.

In case of images, we need to assign a label to an image, which describes and classifies that image. Or using same service, we can annotate parts of images and again tell the system what is that particular part of an image. For example, a wheel as a part of the car in the picture.

### Objectives

In this lab, you will:

* Create a new dataset using images from object storage
* Label images using Data Labeling utility
* Programmatic (Bulk) Image labeling

### Prerequisites

This lab assumes you have:

* Completed previous labs of this workshop: **Prepare Environment** and **Lab 1: Image Library**.

## Task 1: Label images using Data Labeling tool

Basic data labeling tool is provided within OCI. With this labeling tool, you can label one image at the time, which is useful if your image library is not too large. In case of larger libraries, manual image labeling can be very time consuming and error prone. That is why, you will use programmatic data labeling using utilities provided by Oracle. Required code and instructions will be provided in the next session.

But before you continue, you need to perform the first step, **Create Dataset** based on your object storage based Image Library.

1. Step 1: **Create Dataset**

    Navigate again to **Data Labeling** page you've entered in the first task of this Lab.

    Make sure you've selected your *root* compartment, ie. **Box-of-Chocolates** and then click **Create dataset**.

    ![](./images/lab2_014.png " ")

2. Step 2: Define your dataset - **Add dataset details**

    Use **Create dataset** wizard and set the parameters of your dataset.

    First, **Name** your dataset and optionally add **Description** and provide **Labeling instructions**

    ![](./images/lab2_015.png " ")

    Click *Images* from **Dataset format** and *Single label* for **Annotation class**.

    Click **Next**

3. Step 3: Define your dataset - **Add files and labels**

    In the 2nd step choose *Select from Object Storage* and provide **Object Storage location** details. This should be your bucket (ie. Box-of-Choclates) where you've put all of your images.

    ![](./images/lab2_016.png " ")

    Then *scroll* down to the lower section of this step.

    Your images will be displayed.

    ![](./images/lab2_017.png " ")

    Enter two labels: *PNEUMONIA* and *NORMAL* in **Labels set** field.

    ![](./images/lab2_018.png " ")

    Click **Next**.

4. Step 4: Define your dataset - **Review** and **Create**

    Review your dataset details and click **Create**

5. Step 5: Generating records

    Records for your dataset will be generated. You will have to wait for approx. 30 minutes. You can track the progress in top right corner.

    ![](./images/lab2_019.png " ")

6. Step 6: Review your dataset

    When finished, you can review the result of the records generation activity. For example, you can see that there were 4881 records generated, none of them have been labeled yet.

    ![](./images/lab2_020.png " ")

    You can switch between **Data records** and **Gallery view** details.

    ![](./images/lab2_021.png " ")

7. Step 7: Open Data Labeling tool and set labels manually

    You can click on the first image and **Data Labeling** tool will open. Since the first image is from *PNEUMONIA* folder, you should label it as *PNEUMONIA*.

    Click **Save & next** and continue with manual labeling process.

    ![](./images/lab2_023.png " ")

    When you're done with labeling, exit by clicking **Cancel**. You can now check how many records have been labeled. In our example, only 1 out of 4881 records.

    ![](./images/lab2_024.png " ")

## Task 2: Bulk image labeling

We have 4881 images to label. This is too much to label images manually, hence we will use Python program to label images programmatically.

Oracle provides code which can be adjusted and used in your specific case. You can find the *original code* on [Github](https://github.com/oracle-samples/oci-data-science-ai-samples/tree/master/data_labeling_examples).

![](./images/lab2_025.png " ")

We have used original Python code and adjusted it to this labs requirements. You will upload this adjusted code to your OCI environment and run it there.

1. Step 1: Download Python code.

    Download [lab2.zip](./files/lab2.zip) to your computer.

    You don't have to extract the zip file to your laptop as you will upload it as such to your OCI environment.

    If unzipped, *lab2.zip* has the following structure:

    ![](./images/lab2_301.png =60%x*)

2. Step 2: Open **Cloud Shell**

    In the OCI Console, on the top bar, click **Developer Tools** icon to open associated menu and choose **Cloud Shell** option. That would open **Cloud Shell** terminal window.

    ![](./images/lab2_302.png " ")

3. Step 3: Upload pre-prepared files for data labeling.

    In the **Cloud Shell** click **Cloud Shell Menu** icon (top right icon). Select **Upload**.

    ![](./images/lab2_303.png =200px*)

    This opens a dialog window. Drop lab2.zip file onto designated area or browse your computer and upload it. Observe that file name appears in the list of files for upload.

    Click **Upload**.

    ![](./images/lab2_304.png =50%x*)

    You can check the upload status during the upload. Once *Completed*, click **Hide**.

    ![](./images/lab2_305.png =50%x*)

    Now you can unzip *lab2.zip* file in your home directory.

    ```console
    unzip lab2.zip
    ```

    ![](./images/lab2_306.png =50%x*)

    Please check that unzip created 2 folders: *data-labeling* and *.oci* (this folder should be hidden) with files as presented in image below:

    ![](./images/lab2_307.png =50%x*)

    You can now minimize **Cloud Shell** terminal as you will need it again a little bit later.

    ![](./images/lab2_308.png =150x*)

4. Update *config.py* with required configuration parameters

    In order to run the data labeling program properly, you need to make some changes in */data-labeling/config.py* and */.oci/config* files. Let's show how to update and configure */data-labeling/config.py* first.

    **4.1 YOUR REGION**

    Probably the easiest way to obtain your region information is to look at the URL. Spot *region* section and copy the value succeeding '=' simbol.

    ![](./images/lab2_309.png =50%x*)

    In our example, region is *eu-frankfurt-1*, but it can not be the case with your instance.

    **4.2 YOUR COMPARTMENT OCID**

    To obtain your compartment OCID navigate to **Compartments** page.

    ![](./images/lab2_310.png " ")

    Your **Compartment OCID** is located in **Compartment Information** tab (default). Click **Show** to display complete OCID and **Copy** to copy it clipboard.

    ![](./images/lab2_311.png =60%x*)

    **4.3 YOUR DATASET OCID**

    **Dataset OCID** can be found on your **Dataset Details Page** under **Data Labeling**. **Dataset OCID** can be found under **Dataset information** tab.

    ![](./images/lab2_312.png " ")

5. Update *config* with required configuration parameters

    *config* file is located in *.oci* folder. This is the file to which *config.py* is referring to in the first line.

    Check this entry in *config.py*:

    ```console
    # config file path
    config_file_path="/home/.oci/config"
    ```

    There are several entries in the *config* file that you need to set:

    **5.1 YOUR USER OCID**

    In your OCI Console, navigate to **Profile** (top right corner icon) and choose **User settings** from the menu.

    ![](./images/lab2_313.png =250x*)

    **User Details Page** opens. You can copy your user OCID information from **User Information** tab. Click **Show** to display complete OCID and click **Copy** to copy OCID to *config* file.

    ![](./images/lab2_314.png " ")

    **5.2 FINGERPRINT FOR PRIVATE API KEY**

    On the same, **User Details** page, you can now obtain also **fingerprint for your private API key**. You will generate your private API key, download it and then upload it into your *.oci* folder.

    Click **API Keys** under **Resources** menu on the left and then click **Add API Key**.

    ![](./images/lab2_315.png =60%x*)

    In the dialog box, click **Download Private Key**. A new *.pem* file will be generated and downloaded to your computer.

    In the **API Keys** section check and copy **Fingerprint** - 16 2-digit string, separated by ':'. Copy this string to *config* file.

    ![](./images/lab2_315-2.png " ")

    **5.3 PATH TO YOUR PRIVATE API KEY**

    Set this entry to

    ```console
    key_file=~/.oci/oci_api_key.pem
    ```

    You have generated and downloaded this file in the previous step, but so far you haven't uploaded it. This will be done in the next step.

    **5.4 YOUR TENANCY OCID**

    For your tenancy OCID, open again **Profile** menu and select Tenancy option. 

    ![](./images/lab2_325.png =200x*)

    Copy **OCID** from **Tenancy Information** tab and paste it into *config* files

    ![](./images/lab2_326.png " ")

    **5.5 YOUR REGION**

    You should have already obtain information about your region. Just reuse it from the previous step.

    You can save *config* file.

6. Step: Upload your **Private Key** file

    You have already generated and downloaded **Private Key** for your user from OCI.

    The file has a name something like this:

    ```console
    -12-01-13-16.pem
    ```
    Rename this *.pem* file to *oci\_api\_key.pem*.

    ```console
    mv -12-01-13-16.pem oci_api_key.pem
    ```
    You can now upload your private key to OCI. 

    In your OCI Console click **Restore** (it should be left-bottom in your console) or open **Cloud Shell** again.

    Click on **Cloud Shell Menu** again and select **Upload**.

    ![](./images/lab2_318.png =100x*)

    When dialog window opens, choose *oci\_api\_key.pem* file to upload, and click **Upload*

    ![](./images/lab2_319.png =200x*)

    Confirm *oci\_api\_key.pem* file was uploaded and click **Hide**

    ![](./images/lab2_320.png =50%x*)

    *oci\_api_key.pem* file is now in your user home folder. (Upload utility always loads file there)

    ![](./images/lab2_321.png =50%x*)

    Move *oci\_api\_key.pem* file to *.oci* folder.

    ```console
    mv oci_api_key.pem ./.oci
    ```

    Check *.oci* folder and confirm it contains to files:  *oci\_api\_key.pem* and *config*.

    ```console
    ls ./.oci -l
    ```

    ![](./images/lab2_322.png =50%x*)

    You are now ready to run the data labeling program. 

7. Step 7: Run *main.py*

    You can finally start bulk labeling. Make sure you are in *data-labeling* folder and run *main.py*.

    ```console
    python3 main.py
    ```
    Program will run approx. 20-30 minutes.

    ![](./images/lab2_327.png " ")

    Once finished, check if all images are labeled now:

    ![](./images/lab2_328.png " ")

    This concludes this session, and now you can start training your new vision model.

## Learn More

* [OCI Data Labeling](https://docs.oracle.com/en-us/iaas/data-labeling/data-labeling/using/home.htm)

## Acknowledgements

* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, December 2022
