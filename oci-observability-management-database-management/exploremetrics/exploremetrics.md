# Create an alarm using Database Management metrics

## Introduction

Using OCI Monitoring service, you can activily monitoring your OCI components using *Metrics* and *Alarms*. Monitoring service receives metrics coming from OCI components like the Compute sending metrics on CPU utilization, DBCS sending metrics on Storage Utilization by tablespace, etc. Custom Metrics can also be sent to the Monitoring service.

We will see how to create *alarms* based on these metrics.

Estimated Time: 20 minutes

### Objectives

In this lab, you will:
* Create a Notification Topic
* Create a Database Alarm using metric
* Check Alarm history

### Prerequisites

This lab assumes you have:
* A valid Oracle Cloud Infrastructure paid account.
* The necessary privileges to create the resources in this lab.

## Task 1: Create a Notification Topic
The Notification Topic is required for the creation of an *alarm*. 

1. Click the navigation menu, click the link *Developer Services*, and then *Notifications*.

	![Image alt text](images/image1.png)

2. Make sure you are location in the *LiveLabs* compartment and click on *Create Topic*.

	![Image alt text](images/image2.png)

3. Provide the following information, Name *LiveLabs_NotificationTopic* and Description *Notification Topic used by Monitoring service*. Click on *Create*.

	![Image alt text](images/image3.png)

4. Once the topic is created, we have to create a subscription. Click on the newly created topic and click on *Create Subscription*.

	![Image alt text](images/image4.png)

5. There several options for selecting the subscription protocol, for example, email, Oracle Cloud Function, or Slack. For this lab, create an email type subscription. Select Email in the *Protocol* dropdown list and provide the email address. Your request will show as *Pending* until you approve this new subscription.

	![Image alt text](images/image5.png)

> **_NOTE:_** If you are not getting the email, please look in your spam folder.

6. Check your email inbox to approve the subscription. Click on *Confirm subscription*.

	![Image alt text](images/image5-1.png)

7. A new browser tab will open to confirm the activation.

	![Image alt text](images/image5-2.png)

## Task 2: Create a Database Alarm using metric

We will create an alarm based on the CPU utilization of
1. Click the navigation menu, click the link *Observability & Management*, and then *Alert Definitions*.

	![Image alt text](images/image6.png)

2. Make sure you are location in the *LiveLabs* compartment and click on *Create Alarm*.

	![Image alt text](images/image7.png)

3. Provide Alarm information, Alarm name `CDB01_CPUCriticalAlarm` and Alarm body *CPU Critical Alarm on CDB01*. Provide Metric information, *LiveLabs* compartment, Metric namespace `oracle_oci_database`, Metric name *CpuUtilization*.

	![Image alt text](images/image8.png)

  > **_NOTE:_** To utilize the metrics that come with *Database Management*, you must use the namespace `oracle_oci_database`.

4. Provide Metric dimensions information, Dimension name *resourceName* and Dimension value *CDB01*. Provide trigger rule information, operator *greater than*, Value *1*, Trigger delay minutes *1*. You will notice the graph automatically updated with the previous information. The red dotted line represents the trigger value. An alarm will be created when CDB01 will utilize 1% of the database allocated CPU.

	![Image alt text](images/image9.png)

5. Provide Destination information, Destination service *Notifications*, *LiveLabs* compartment and Topic previously created *LiveLabs_NotificationTopic*. Make sure to checked *Enable this alarm?* and click on *Save alarm*

	![Image alt text](images/image10.png)

6. You will have the summary of the newly created alarm.

	![Image alt text](images/image11.png)

## Task 3: Check alarm history

1. Click the navigation menu, click the link *Observability & Management*, and then *Alert Definitions*.

	![Image alt text](images/image6.png)

2. Make sure you are location in the *LiveLabs* compartment and click on the desire *Alarm name*.

	![Image alt text](images/image12.png)

3. Go to the bottom of the page, select the desire period and you will see the alarm history. In this example, the alarm fired 2 times. You should have received emails for each transition changes.

	![Image alt text](images/image13.png)

Congratulations! You have completed all the necessary labs and tasks.

## Acknowledgements
* **Author** - Luc Demanche, Cloud & DBA Practice Director, Insum Solutions Inc.
* **Last Updated By/Date** - Luc Demanche, April 2023
