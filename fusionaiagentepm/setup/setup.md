# Create an External REST Tool for EPM

## Introduction

At the time of this writing, Fusion AI Agent Studio has not released any Oracle Cloud EPM business objects. Hence, we have to either connect to EPM Cloud through a dedicated Model Context Protocol i.e. MCP server or through building an External REST Tool. In this lab, we will build an External REST Tool for EPM Cloud to export data. For more information on this EPM REST API, check [Export Data Slices](https://docs.oracle.com/en/cloud/saas/enterprise-performance-management-common/prest/export_dataslices.html)

Estimated Lab Time: 15 minutes

### About creating an External REST Tool in AI Agent Studio
The EPM REST API for Exporting data slices from Essbase will use JSON structure for GET/ POST commands. The key to building the conversational agent is to effectively construct the Tool in the Studio. Therefore, it is important to understand the framework of building a Tool in AI Agent Studio.

### Objectives

In this lab, you will:
* Create an External REST Tool
* Build a REST Function in the Tool

### Prerequisites

This lab assumes you have:
* An Oracle Fusion AI Agent license & account
* An Enterprise EPM license (username & password) to invoke REST API
* An understanding of the EPM REST API structure

## Task 1: Navigation and Understanding of Tools

As a first task let's login and navigate to the Tools

1. Login to **AI Agent Studio**.

	![Agent Studio landing page](images/agentstudiologin.png)

2. Click **Tools**.

    ![Select Tools](images/selecttools.png)

3. Click **Add** button to create a new Tool.

    ![Add Button](images/hitadd.png)


## Task 2: Build the Tool

1. Fill in details for **Tool Type, Tool Name, Tool Code, Family and Product** as shown in the picture below. Additionally leave the **Require human approval** selection turned off. This is the part of setting up the **External REST** Tool.

    ![External REST Setup](images/toolkeyinfo.png)

2. In the Authorization tab, setup **Basic** authentication for the EPM Cloud Planning application.

    ![Basic Auth Setup](images/basicauth.png)

    ![Auth complete](images/authsetup.png)

3. Next click on **Functions** and hit **Add**.
    ![Adding Function](images/addfunction.png)

4. Create the payload for **POST** operation for the [Export Data Slice](https://docs.oracle.com/en/cloud/saas/enterprise-performance-management-common/prest/export_dataslices.html) Cloud EPM REST API.

    ![Setup Detail 1](images/functionsetup1.png)

    ![Setup Detail 2](images/functionsetup2.png)

*Note - Check REST API call through a REST Client to ensure validity before proceeding*

You have now built a key building block namely your **Data Export Tool** in Agent Studio for your first EPM Agent workflow.

Take the following quiz to gauge your knowledge from this lab. 

```quiz
Q: Which component of AI Agent Studio needs to be used to create an External REST call?
- Topics
- Agent Teams
* Tool

Q: Which External REST API from Cloud EPM is needed to extract data?
* Export Data Slices
- Query
- Export Data
```

## Learn More

*Useful resource links:*

* [How to use and build in AI Agent Studio](https://docs.oracle.com/en/cloud/saas/fusion-ai/aiaas/overview.html)


## Acknowledgements
* **Author** - Vatsal Gaonkar, Director, Digital Core Modernization, PwC
* **Last Updated By/Date** - Vatsal Gaonkar, March 2026
