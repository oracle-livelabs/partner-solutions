# Introduction

## About this Workshop

This workshop covers one workflow, among several, in a software modernization project to migrate legacy Oracle Forms based applications to a newer low-code platform such as Oracle APEX using tools and methodolody developed by PITSS Gmbh. The complete workflow uses graph analytics to find clusters of code modules related to a business process, or common functionlaity such as logging or security, redundancy among code blocks, and unused or dead code. This workshop will focus on cluster determination.

### Why Graph Analytics

Graphs have uses in unexpected places, like analyzing software apps in hours instead of weeks. Software development is a complex ever-evolving process. The longer any software exists in the market the more complex it is to maintain. Development frameworks like Oracle Forms have been in the market for over 40 years and used to build mission critical applications over the years. Incremental development often results in increased complexity and higher maintenance costs or difficulty finding people with the necessary skills and knowledge of the framewrok. Hence there is a need for tools that semi-automate the analysis and modernization of legacy software.

### What are some concerns with leagcy applications  

- They do not differentiate between layers of responsibility and therefore are harder to maintain as distinct tasks. Data management, business logic, and user interfaces are often intertwined.
- They combine functionality into one mass of code rather than components with specific functionality. Therefore, it becomes cumbersome to uptake newer technology for a specific function such as security or notifications or mobile app development. In today's modern software frameworks, these functionalities are handled by independent libraries or frameworks.
- They are inflexible from a business perspective. These applications are loaded with features, added by the developer over time, and are difficult to adapt or customize to a new or revised business process. In contrast modern application development is driven more by a process flow.

### What does PITSS.CON facilitate

Legacy applications often have the data model and business logic embedded in the code itself rather than in any metadata. The PITSS tooling loads the application, and any available metadata or data dictionary content, into a common repository. It then parses the code and builds an abstract syntax tree which enables it to identify   

- the relationship between application modules and business processes 
- common functionality such as logging, security, or notifications
- unused modules or code blocks
- redundant code blocks that various developers may have copied and pasted 

That is just one step in a workflow which helps identify bounded application contexts and then create largely independent and balanced task groups for migrating the application to a modern development framework and platform such as Oracle APEX. 


Estimated Time: 1 hour.


### Objectives

In this workshop, you will learn how to:

* Provision an Autonomous Database
* Setup a database user
* Load sample data into the database
* Create a property graph
* Query and analyze the proerty graph using an interactive notebook

### Prerequisites 

This lab assumes you have:

* An Oracle account
* An Oracle Cloud tenancy with available credits
* Some familiarity with SQL
* Familiarity with Python is helpful
* Familiarity Oracle Cloud Infrastructure is helpful
* Familiarity with Oracle Autonomous Database is helpful
* Familiarity with interactive notebooks such as Zeppelin or Jupyter is helpful


## Learn More

* [PITTSS.CON product page](https://pitss.com/forms2apex-modeler/)
* [Webcast on modernizing legacy applications](https://www.youtube.com/watch?v=6pzXxvT8BRk)
* [Information on Graph Studio](https://www.oracle.com/autonomous-database/graph/get-started/)
* [Livelabs workshop on Graph Studio on Autonmous Database](https://apexapps.oracle.com/pls/apex/dbpm/r/livelabs/view-workshop?wid=770)

## Acknowledgements

* **Author** - Jayant Sharma, Product Management
* **Contributors** -  Neelima Tadikonda, Stephan LaRocca (PITSS Gmbh)
* **Last Updated By/Date** - Jayant Sharma, July 2023
