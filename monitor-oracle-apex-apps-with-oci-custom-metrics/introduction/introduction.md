# Introduction

## About this Workshop

![Insum Logo](./images/insum-logo.png =300x300)

**Community Contributed Workshop**

* **Author:** *Adrian Png, Senior Cloud Solutions Architect, Insum Solutions Inc.*

The *Oracle Cloud Infrastructure* (OCI) Monitoring services include service metrics that allow administrators to monitor the health and performance of many OCI services and resources. Administrators may also publish *custom metrics* for special use cases such as monitoring the state of an application deployed on an OCI *Compute* instance. These are sent to a special OCI REST endpoint that ingests telemetric data. Alarms can then be created to alert administrators when metric limits are exceeded.

In this workshop, we will publish a custom metric that monitors the number of failed user logins to an *Oracle APEX* application. We will query an Oracle APEX view that logs user access, and then post the data to the REST endpoint using the PL/SQL package `APEX_WEB_SERVICE`. This code will be executed using Automations, a feature of Oracle APEX that allows developers to schedule and perform actions based on specific triggers and conditions.

Estimated Time: 60 minutes

### Objectives

In this workshop, you will:

* Create the required OCI resources to support publishing custom metrics to the OCI.
* Setup an Oracle APEX development environment with an *Oracle Autonomous Database*.
* Create an Oracle APEX Automation that publishes custom metrics to the OCI.
* Set up OCI *Notifications* and subscribe to it.
* Create an OCI Monitoring *Alarm* that notifies you when the number of failed user logins exceeds the preset limit.

### Prerequisites

This lab assumes you have:

* Access to an Oracle Cloud tenancy.
* Basic knowledge of Oracle APEX and PL/SQL development.
* Familiarity with Oracle Cloud Infrastructure is helpful.

## Learn More

* [Oracle Cloud Infrastructure](https://www.oracle.com/cloud/)
* [Observability and Management](https://www.oracle.com/manageability/)
* [Oracle APEX](https://apex.oracle.com/learnmore)

## Acknowledgements

* **Author** - Adrian Png, Senior Cloud Solutions Architect, Insum Solutions Inc.
* **Last Updated By/Date** - Adrian Png, February 2023
