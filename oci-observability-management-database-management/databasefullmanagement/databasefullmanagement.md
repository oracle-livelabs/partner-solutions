# Explore Database Full Management option with DBCS

## Introduction

In this lab, we will see capabilities that come with Database Full Management option.

Estimated Time: 15 minutes

### Objectives

In this lab, you will:
* Explore the Fleet Summary
* Explore monitoring a specific database
* Explore alert log details
* Explore tablespace details
* Explore SQL Tuning Advisor

### Prerequisites

This lab assumes you have:
* This lab assumes you have the necessary privileges

## Task 1: Explore the Fleet Summary

Fleet summary provides an unified view of your Oracle databases. In this single point of view, you can see performance statistics about Active Sessions, CPU Allocation/Usage, Storage Allocation/Usage and I/O Rate/Throughput.

Make sure you have selected the right *Compartment*. Select the Inventory type *CDB*. Select the *Time period*.

You will get the information for the *CDB01*, *Average Active Sessions*, *CPU*, *Storage* and *I/O* information. You can chance the *Time period* or the *Comparison* period as you want.

1- Click on the *CDB01* to go to *Managed database details* page.

  ![Image alt text](images/image1.png)

## Task 2: Explore monitoring a specific database

From the *Managed database details*, we can see the following information:
* Name of the component: *CDB01*
* Configuration: *SI CDB*, which means Standalone CDB
* Connection status: *OK*
* Alarms: *No open alarms*

From this page, you can also open the *Performance Hub*, *AWR Explorer* and *Dashboard* page. We will see them later.

![Image alt text](images/image2.png)

1- Click on *Summary* under the *Resources* menu. You will get the summary information for the *CDB01* for the selected *Time period*. Information like *Availability timeline*, *CPU Activity*, *I/O*, *Memory* and *Storage* will be displayed.

![Image alt text](images/image3.png)

  > **_NOTE:_** If you select the *PDBs* tab, you will get similar information but for the PDBs.

## Task 3: Explore alert log details

1- Click on *Alert Logs* under the *Resources* menu. You will get the content of the alert log file. You can filter by level or type, so some search. You can also get more details by clicking on the arrow.

![Image alt text](images/image4.png)

  > **_NOTE:_** *Attention log* is a feature available on database 21c or higher.

## Task 4: Explore tablespace details

## Task 5: Explore SQL Tuning Advisor

## Acknowledgements
* **Author** - Luc Demanche, Cloud & DBA Practice Director, Insum Solutions Inc.
* **Last Updated By/Date** - Luc Demanche, April 2023
