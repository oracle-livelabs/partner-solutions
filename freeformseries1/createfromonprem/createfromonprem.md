# Create FreeForm application using an Oracle Essbase Outline

## Introduction

One of the main use cases for FreeForm application is the ease with which an Essbase outline can be used to build FreeForm application in Cloud EPM. 	![Use case summary for Oracle FreeForm applications](images/usecasesummary.png)
In this lab, we will use an existing Essbase outline for Aggregate Storage Option (ASO) and create a FreeForm application from it.

Estimated Lab Time: 7 minutes

### About creating FreeForm application using on-premises outline
Use Cloud EPM FreeForm application to migrate on-premises Essbase outline. The process will use an outline file from on-premises application to build the FreeForm ASO application.

### Objectives

In this lab, you will:
* Import an ASO outline to Cloud EPM
* Create a FreeForm application using the ASO outline

### Prerequisites

This lab assumes you have:
* Access to an Essbase on-premises outline file
* An Oracle Cloud EPM Enterprise subscription
* Service administrator rights to the instance where you are going to create the FreeForm application


## Task 1: Creation Process

1. Hit **Start** under **Create a new application**.

	![Select start to create new application](images/selectstartonprem.png)

2. Populate **Name** and **Description** for the FreeForm application being created.

  ![Put in application name and description](images/namedescription.png)

3. Ensure **Application Setup** is set to **Import Essbase OTL/LCM**. You will need to specificy the **Location** of the file which could either be your **Local drive** or the **Application Inbox**.

  ![Ensure appropriate setup](images/setuplocation.png)

4. Once the **Import File (Outline File)** is selected you will see the outline populated. Hit **Next**.

  ![Outline uploaded](images/onpremoutline.png)

5. **Review** all your details before hitting **Create**. Once you hit **Create**, an **Application Creation Status** window will guide you through the creation process.
  ![Review before creating](images/beforecreate.png)  
  ![Application creation status](images/creationstatus.png)

6. You have created a **FreeForm application using an Oracle Essbase outline** (an on-premises outline).
  ![Creation successful](images/creationcomplete.png)
   
## Learn More

*Learn more about FreeForm applications by using the links below*

* [Information on Oracle Cloud EPM FreeForm](https://www.oracle.com/performance-management/freeform/) 
* [Create using Outline or a LCM package aka snapshot](https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/creating_a_freeform_app_using_an_outline_file_or_snapshot.html)
* [Freeform Apps FAQs](https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/freeform_apps_faq.html)

## Acknowledgements
* **Author** - Vatsal Gaonkar, Director - Cloud & Digital, PwC
* **Last Updated By/Date** - Vatsal Gaonkar, June 2024
