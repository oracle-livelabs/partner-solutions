# Prepare Setup

## Introduction
This lab will show you how to download the Oracle Resource Manager (ORM) stack zip file needed to set up the resource needed to run this workshop.

*Estimated Lab Time:* 10 minutes

### Objectives
-   Download ORM stack
-   Configure an existing Virtual Cloud Network (VCN)

### Prerequisites
This lab assumes you have:
- An Oracle Cloud account

## Task 1: Download Oracle Resource Manager (ORM) stack zip file
1.  Click on the link below to download the Resource Manager zip file you need to build your environment:

    *Note 1:* If providing a single Stack download for the workshop, use this simple expression.

    - [sample-mkplc-freetier.zip](https://objectstorage.us-ashburn-1.oraclecloud.com/p/juVJbC9MgDKF1QzyJkgEHzqeCN1bLi7XGyHAZMXnw6Ci-8yJj-UKNC9SPJRIR7Ib/n/c4u02/b/hosted_workshops/o/stacks/ll-orm-mkplc-tenancy.zip)

    *Note 2:* If providing multiple Stacks download for the same workshop, use a conditional expression similar to the below. Keep in mind that the condition or *type* must be paired with a valid entry in the *manifest.json* file. Refer to *freetier-advanced* and *freetier-basics*

<if type="advanced">
    - [sample-mkplc-advanced.zip](https://objectstorage.us-ashburn-1.oraclecloud.com/p/2-pWdKTRReH7z_v8n854ZpYazHK1kD-eZni2GFC7dJREQauomX-wJ6RPKHMaeZZB/n/c4u02/b/hosted_workshops/o/stacks/ll-orm-mkplc-tenancy-advanced.zip)
</if>
<if type="basics">
    - [sample-mkplc-basics.zip](https://objectstorage.us-ashburn-1.oraclecloud.com/p/eJzg9ZI4hnSXldacpoX6PaGaPbvcufnYqmpIVWV1j10ZjPObIKUeSwNa89H5XZjV/n/c4u02/b/hosted_workshops/o/stacks/ll-orm-mkplc-tenancy-basics.zip)
</if>

2.  Save in your downloads folder.

We strongly recommend using this stack to create a self-contained/dedicated VCN with your instance(s). Skip to *Task 3* to follow our recommendations. If you would rather use an existing VCN then proceed to the next task to update your existing VCN with the required Ingress rules.

## Task 2: Adding security rules to an existing VCN

This workshop requires a certain number of ports to be available, a requirement that can be met by using the default ORM stack execution that creates a dedicated VCN. In order to use an existing VCN/subnet, the following rules should be added to the security list.

| Type           | Source Port    | Source CIDR | Destination Port | Protocol | Description                           |
| :-----------   |   :--------:   |  :--------: |    :----------:  | :----:   | :------------------------------------ |
| Ingress        | All            | 0.0.0.0/0   | 22               | TCP      | SSH                                   |
| Ingress        | All            | 0.0.0.0/0   | 80               | TCP      | Remote Desktop using noVNC            |
| Egress         | All            | N/A         | 80               | TCP      | Outbound HTTP access                  |
| Egress         | All            | N/A         | 443              | TCP      | Outbound HTTPS access                 |
{: title="List of Required Network Security Rules"}

<!-- **Notes**: This next table is for reference and should be adapted for the workshop. If optional rules are needed as shown in the example below, then uncomment it and add those optional rules. The first entry is just for illustration and may not fit your workshop -->

<!--
| Type           | Source Port    | Source CIDR | Destination Port | Protocol | Description                           |
| :-----------   |   :--------:   |  :--------: |    :----------:  | :----:   | :------------------------------------ |
| Ingress        | All            | 0.0.0.0/0   | 443               | TCP     | e.g. Remote access for web app        |
{: title="List of Optional Network Security Rules"}
-->

1.  Go to *Networking >> Virtual Cloud Networks*
2.  Choose your network
3.  Under Resources, select Security Lists
4.  Click on Default Security Lists under the Create Security List button
5.  Click Add Ingress Rule button
6.  Enter the following:  
    - Source Type: CIDR
    - Source CIDR: 0.0.0.0/0
    - IP Protocol: TCP
    - Source Port Range: All (Keep Default)
    - Destination Port Range: *Select from the above table*
    - Description: *Select the corresponding description from the above table*
7.  Click the Add Ingress Rules button
8. Repeat steps [5-7] until a rule is created for each port listed in the table

## Task 3: Setup Compute   
Using the details from the two Tasks above, proceed to the lab *Environment Setup* to set up your workshop environment using Oracle Resource Manager (ORM) and one of the following options:
-  Create Stack:  *Compute + Networking*
-  Create Stack:  *Compute only* with an existing VCN where security lists have been updated as per *Task 2* above

You may now proceed to the next lab.

## Acknowledgements
* **Author** - Rene Fontcha, LiveLabs Platform Lead, NA Technology
* **Contributors** - Meghana Banka
* **Last Updated By/Date** - Rene Fontcha, LiveLabs Platform Lead, NA Technology, August 2022
