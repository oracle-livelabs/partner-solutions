# Optimal configuration tips

## About

There are certain considerations to optimize a FreeForm application. This lab will start the process of building to optimize some of such configurations, one of which was already done in the previous lab for **Period** dimension during the creation of the **Scratch** FreeForm application. In addition to understanding **Period** dimension configuration, you will also be uploading additional dimensions to pave the way for follow-on optimal configurations in the following workshop and labs.

Estimated Lab Time: **10 minutes**

### Objectives

In this lab, you will:
* Adjust configurations of FreeForm application namely **Scratch** that you just created using the **Application Creation Wizard**.
* Add dimensions and members to the **Scratch** application using **Import Metadata** feature.
* Understand an optimal configuration for **Period** dimension vis-a-vis **BSO** and **ASO** plan types.

### Prerequisites

This lab assumes you have:
* An Oracle EPM Enterprise Cloud subscription
* Service administrator rights to the instance where you are going to create the FreeForm application


## Dimension configuration

1. Navigate to dimensions in the application created in the previous lab. Click on **Overview** and the navigate to **Dimensions**.
	![Image alt text](images/appoverview.png)
	![Image alt text](images/appdimensions.png)

2. When in **Dimensions** toggle or ensure that you have picked **All** in the dropdown.
	![Image alt text](images/alldimensions.png)
	![Image alt text](images/appdimensions.png)
	![Image alt text](images/measureaccount.png)

3. Create 3 more dimensions namely **Scenario**, **FiscalYear** and **Company**
    ![Image alt text](images/createdim.png)
	![Image alt text](images/scenariodim.png)
	![Image alt text](images/scenariocreated.png)

4. Similary create **FiscalYear** and **Company**. Next we will import members into these dimensions using files.
	![Image alt text](images/fiscalyearcompany.png)

5. Download the files with members for [Company dimension](files/Company.csv) [Measures dimension](files/Measures.csv) [FiscalYear dimension](files/FiscalYear.csv) [FiscalPeriod dimension](files/FiscalPeriod.csv) and [Scenario dimension](files/Scenario.csv) to your local drive. 

6. From **Overview>Dimensions** hit **Import**.
	![Image alt text](images/importdimensions.png)

7. Hit **Create** and navigate to assign files 
	![Image alt text](images/createimportjob.png)


## Learn More

*Learn more about FreeForm applications by using the links below*

* [Create using Application Creation Wizard](https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/creating_a_freeform_app_using_the_application_creation_wizard.html)
* [FreeForm Apps FAQs](https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/freeform_apps_faq.html)

## Acknowledgements
* **Author** - Vatsal Gaonkar, Director - Cloud & Digital, PwC
* **Last Updated By/Date** - Vatsal Gaonkar, March 2023