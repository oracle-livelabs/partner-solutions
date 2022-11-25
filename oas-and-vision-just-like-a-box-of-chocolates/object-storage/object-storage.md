# Load Images to Object Storage

## Introduction

This lab walks you through the steps to organize an image library in OCI Object Storage and upload X-Ray images to the that library.

Estimated Time: 20 minutes

### About OCI Object Storage
The Oracle Cloud Infrastructure Object Storage service is an internet-scale, high-performance storage platform that offers reliable and cost-efficient data durability. 

The Object Storage service can store an unlimited amount of unstructured data of any content type, including analytic data and rich content, like images and videos.

### Objectives

In this lab, you will:
* Setup a new user group with required privileges to manage compartments
* Create a new compartment in OCI Object Storage
* Create a new bucket in a newly created compartment
* Setup required folder structure
* Load images

### Prerequisites 

This lab assumes you have:
* An Oracle Cloud account

## Task 1: Cretae a new group 

(optional) Task 1 opening paragraph.

1. Step 1

	![Image alt text](images/sample1.png)

  To create a link to local file you want the reader to download, use the following formats. _The filename must be in lowercase letters and CANNOT include any spaces._

	Download the [starter file](files/starter-file.sql) SQL code.

	When the file type is recognized by the browser, it will attempt to render it. So you can use the following format to force the download dialog box.

	Download the [sample JSON code](files/sample.json?download=1).

  > Note: do not include zip files, CSV, PDF, PSD, JAR, WAR, EAR, bin, or exe files - you must have those objects stored somewhere else. We highly recommend using Oracle Cloud Object Store and creating a PAR URL instead. See [Using Pre-Authenticated Requests](https://docs.cloud.oracle.com/en-us/iaas/Content/Object/Tasks/usingpreauthenticatedrequests.htm)
2. Step 2

  ![Image alt text](images/sample1.png)

4. Example with inline navigation icon ![Image alt text](images/sample2.png) click **Navigation**.

5. Example with bold **text**.

   If you add another paragraph, add 3 spaces before the line.

## Task 2: Concise Task Description

1. Step 1 - tables sample

  Use tables sparingly:

  | Column 1 | Column 2 | Column 3 |
  | --- | --- | --- |
  | 1 | Some text or a link | More text  |
  | 2 |Some text or a link | More text |
  | 3 | Some text or a link | More text |

2. You can also include bulleted lists - make sure to indent 4 spaces:

    - List item 1
    - List item 2

3. Code examples

    ```
    Adding code examples
  	Indentation is important for the code example to appear inside the step
    Multiple lines of code
  	<copy>Enclose the text you want to copy in <copy></copy>.</copy>
    ```


## Learn More

* [OCI Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/home.htm)


## Acknowledgements
* **Author** - Žiga Vaupot [image](../introduction/images/SpadeACEPro.png "Oracle ACE Pro"), Qubix Intl.
* **Contributors** -  Grega Dvoršak, Qubix Intl.
* **Last Updated By/Date** - Žiga Vaupot, November 2022