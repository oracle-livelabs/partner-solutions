# Optimize configuration
## Introduction
In this lab, you will create and add members to dimensions in the FreeForm application. Additionally, you will also gather understanding of optimal FreeForm application configuration settings.  

Estimated Lab Time: 10 minutes

### About optimizing FreeForm applications
There are certain considerations to optimize a FreeForm application. This lab will start the process of building to optimize some such configurations, one of which was already done in the previous lab for **Period** dimension during the creation of the **Scratch** FreeForm application. In addition to understanding **Period** dimension configuration, you will also be uploading additional dimensions to pave the way for follow-on optimal configurations in the following workshop and labs.


### Objectives

In this lab, you will:
* Adjust configurations of FreeForm application namely **Scratch** that you created in the previous lab using **Application Creation Wizard**.
* Add dimensions and members to the **Scratch** application using **Import Metadata** feature.
* Understand an optimal configuration for **Period** dimension vis-a-vis **BSO** and **ASO** plan types.

### Prerequisites

This lab assumes you have:
* An Oracle EPM Enterprise Cloud subscription
* Service administrator rights to the instance where you are going to create the FreeForm application


## Task 1: Dimension configuration

1. Navigate to dimensions in the application created in the previous lab. Click on **Overview** and the navigate to **Dimensions**.
	![Overview of the application](images/appoverview.png)
	![Go to application dimensions](images/appdimensions.png)

2. When in **Dimensions** toggle or ensure that you have picked **All** in the dropdown.
	![Toggle to view all cubes dimensions](images/alldimensions.png)
	![FiscalPeriod and Measures dimension for both cubes](images/measureaccount.png)

3. Create 3 more dimensions namely **Scenario**, **FiscalYear** and **Company**
    ![Create additional dimensions](images/createdim.png)
	![Scenario dimension and its setup](images/scenariodim.png)
	![Scenario dimension created](images/scenariocreated.png)

4. Similary create **FiscalYear** and **Company**. Next we will import members into these dimensions using files.
	![Create FiscalYear and Company like Scenario dimension](images/fiscalyearcompany.png)

5. Download the files with dimension members below to your local drive
	* [Company dimension](https://c4u04.objectstorage.us-ashburn-1.oci.customer-oci.com/p/ahMJ_iEi0eYYghm8bSASXsTTjZYy2eul9w-cpW_XyqMtq64r6ELoZWTK36cuatCS/n/c4u04/b/livelabsfiles/o/partner-solutions/freeformseries1/Company.csv) 
	* [Measures dimension](https://c4u04.objectstorage.us-ashburn-1.oci.customer-oci.com/p/ahMJ_iEi0eYYghm8bSASXsTTjZYy2eul9w-cpW_XyqMtq64r6ELoZWTK36cuatCS/n/c4u04/b/livelabsfiles/o/partner-solutions/freeformseries1/Measures.csv) 
	* [FiscalYear dimension](https://c4u04.objectstorage.us-ashburn-1.oci.customer-oci.com/p/ahMJ_iEi0eYYghm8bSASXsTTjZYy2eul9w-cpW_XyqMtq64r6ELoZWTK36cuatCS/n/c4u04/b/livelabsfiles/o/partner-solutions/freeformseries1/FiscalYear.csv) 
	* [FiscalPeriod dimension](https://c4u04.objectstorage.us-ashburn-1.oci.customer-oci.com/p/ahMJ_iEi0eYYghm8bSASXsTTjZYy2eul9w-cpW_XyqMtq64r6ELoZWTK36cuatCS/n/c4u04/b/livelabsfiles/o/partner-solutions/freeformseries1/FiscalPeriod.csv)
	* [Scenario dimension](https://c4u04.objectstorage.us-ashburn-1.oci.customer-oci.com/p/ahMJ_iEi0eYYghm8bSASXsTTjZYy2eul9w-cpW_XyqMtq64r6ELoZWTK36cuatCS/n/c4u04/b/livelabsfiles/o/partner-solutions/freeformseries1/Scenario.csv) 

6. From **Overview>Dimensions** hit **Import**.
	![Import dimensions](images/importdimensions.png)

7. Hit **Create** and navigate to select the downloaded files to build dimensions.
	![Create import dimension job](images/createimportjob.png)
	![Choose downloaded import files](images/choosedimfiles.png)
	![Run the import](images/clickimport.png)
   
   Check the **Refresh Database if Import Metadata is successful** option and hit **OK**.
	![Check Refresh Database on the pop up window](images/refreshoption.png)

   Job successfully submitted window appears - Hit **OK**.
    ![Job successfully submitted window](images/jobsubmitted.png)

8. Hit **Close** on open windows for the application and go to **Jobs** to check the status of dimension build.
	![Go to Jobs to check status of Import and Refresh Database](images/jobs.png)
   
   Check to ensure both **Import Metadata** and **Refresh Database** were successful. You have completed the build of dimensions.
   ![Successful import and refresh jobs](images/jobsuccessful.png)
   

## Task 2: Tips and Techniques
### Period dimension assignment
You can confirm that your **FiscalPeriod** dimension is a **Period** or **Time** dimension by navigation to **Application>Overview>Dimensions** and checking the **time** icon on the cube in front of dimension name.
	![Image alt text](images/timedimension.png)

Assigning the time or period dimension appropriately aids in two main aspects - 
* Ensuring seamless period mapping with **Data Integration** which is an integration layer for EPM Cloud applications. For more information check  [Data Integration](https://docs.oracle.com/en/cloud/saas/enterprise-performance-management-common/diepm/integrations_about_110x65a03764.html)
* For ASO (Aggregate Storage Option) databases in an application, setting a compression dimension ensures performant ASO databases. It is always recommended to make the most dense dimension in an ASO database as the compression dimension, yet at the same time EPM Cloud does not expose the ability to pick a compression dimension. By virtue of picking a **Period** or **Time** dimension, ASO in EPM Cloud automatically makes that dimension (in this case **FiscalPeriod**) a compression dimension, thereby ensuring optimal performance.

### Additional Tips and Techniques
A following workshop will share tips and techniques on optimizing FreeForm applications in areas of - 
* How to design optimal Data forms in absence of start and end periods from scenario management. For more information check [Designing Data Forms](https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/forms.html)
* Using subvars and groovy business rules to create data form open and close periods. For more information check [About Substitution Variables](https://docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/about_substitution_variables.html)
* Using groovy business rules to ensure focused data pushes between ASO and BSO plan types. For more information check [Groovy business rules](https://www.oracle.com/webfolder/technetwork/tutorials/obe/cloud/epm/Groovy/Introduction/index.html)

## Acknowledgements
* **Author** - Vatsal Gaonkar, Director - Cloud & Digital, PwC
* **Last Updated By/Date** - Vatsal Gaonkar, March 2023