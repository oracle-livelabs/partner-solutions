# Submit New Workshop to Oracle LiveLabs

## Introduction

This lab walks you through the steps to submit a new LiveLabs Workshop request.

### Objectives

* Submit a LiveLabs workshop request through email

## Task 1: Submit a Workshop Request to the Oracle LiveLabs

Before you get started, you should submit your new LiveLabs workshop request by sending an email to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com) for the Oracle LiveLabs team to review. Submitting a workshop informs the Oracle ecosystem that you are working on a workshop and submits your idea to the Workshop Council. We urge you not to delay this step. There are hundreds of workshops already, this step is important to help us preserve the quality and integrity of the workshop catalog.

1.  Download this [Submit Workshop Details document](https://objectstorage.us-ashburn-1.oraclecloud.com/p/Vi68eJYNv_M4E-j-lE2-2cWItoiOG8dLZOUWSZBaHoj248RB0xGjBH8An8S4ehTd/n/id05dmgeno0f/b/partner-solutions/o/Submit_Workshop_Details_v1_072222.xlsx) and provide all the below required *Workshop Information*. Failure to provide all the details will prevent your workshop from being approved.

	-	*Workshop Title:* Choose a descriptive title up to 200 characters. Do not include the word "Workshop" or "Lab" and use "Oracle Speak". Choose a title that users would recognize or understand. Do not use abbreviations ("Autonomous Database" not "ADB") and start the title with an imperative verb ("Build" not "Building").
	-	*Workshop Abstract:* Provide the workshop abstract details **thoroughly** as it is used for approval by the workshop council. Workshops are reviewed by the workshop council for adherence to current Oracle messaging. If you do not provide enough details, the council may revert back for more details and this may delay your workshop approval.
		-	What is the Workshop Elevator Pitch/Messaging?
		-	Provide brief details on the Workshop?
		-	Why is this workshop needed?
		-	What products/technologies are used in the workshop?
		-	Is there a primary Oracle product/technology being showcased? If so, what is it?
	-	*Short Description:* The short description is the key piece of information that goes on the tile of the workshop. Keep it crisp, catchy, and interesting. The length is up to 400 characters.
	-	*Long Description:* The long description is a thorough description of the workshop that goes on the details page of the workshop.
	-	*Workshop Team Members:* Provide the email address for everyone in the Workshop Team. They will be able to edit this workshop at any point in the workflow.
		- Workshop Owner: Owner and primary Contact of the workshop. Responsible for workshop content being correct, accurate, and up-to-date. Also must keep accurate information in WMS for this workshop.
		- Technical Contact: Expert of Labs in Workshop. This person will answer customer's questions via email, Stack Overflow, etc. If not identified, the Workshop Owner will assume this role.
		-	Support Contact: Adapts Workshop to GitHub and LiveLabs. This person will move content to Github, Self QA the workshop, and add/maintain the "Need Help" or "Troubleshooting" section of the workshop. If not identified, the Workshop Owner will assume this role.
		-	Manager Contact: Works with the Workshop Owner to complete the workshop and keep information accurate. This person is responsible for ensuring that there is a current and valid Workshop Owner.
		-	Observer: This optional field is just for someone that wants to keep an eye on the workshop but does not have any responsibilities. Keep in mind that this person will have write permissions on this workshop.
	-	*Workshop Outline:* Provide the title of each of your labs within the workshop.
	-	*Workshop Prerequisites:* Provide the necessary prerequisites a user would need before attempting your workshop. For example, Some understanding of cloud and database terms is helpful, Familiarity with Oracle Cloud Infrastructure (OCI) is helpful, Familiarity with Database is desirable, but not required.
	-	*Level:* What is the Level of workshop - Beginner, Intermediate, Advanced?
	-	*Role:* Who can run this workshop? For example, DBA, Business Analyst, etc. Click on Tags tab of the downloaded Submit Workshop Details document to view the options.
	-	*Focus*: What is the focus of this workshop? For example: Database, AI/ML, Low Code, etc. Click on Tags tab of the downloaded Submit Workshop Details document to view the options.
	-	*Product*: What are the products demonstrated in this workshop? For example, Blockchain, Data Safe, Autonomous JSON Database, etc. Click on Tags tab of the downloaded Submit Workshop Details document to view the options.
	-	*Publish Type*: Choose the below modes to display the content on Oracle LiveLabs
		-	Public - The workshop is available through Oracle LiveLabs search and links to the public.
		-	Private - The workshop is available by the public only through links shared to the workshop team; it is not available to the public through Oracle LiveLabs search.
	-	*Workshop Environment:* On which type of tenancy does your workshop run?
		-	Run on your tenancy - The workshop content can run either in customers Always Free, Free Tier or Paid tenancies.
		-	Run on LiveLabs - The workshop is done in a registered LiveLabs tenancy, a.k.a Green Button. With Green Button, users can run the workshop in pre-provisioned environments. Users have to complete the workshop in a specified limited amount of time. After their reservations expire, any instances they create will be destroyed. However, users can extend their reservations up to 4 times.
	- 	*Workshop Time*: The time to complete the entire workshop
	-	*Anticipated Completion Date:* When do you anticipate this workshop to be completed?

2. Provide the *Social* details like share a link to the blog of your workshop, write a couple of sentences that would accompany a LinkedIn post about your workshop, and write a tweet (limit 240 characters) to be used to promote your workshop. Of course this can be done anytime while working on your workshop, or maybe you are using a blog to create the workshop. These details should be completed for when your workshop is published.

We recommend you do not start working on your workshop until your workshop has been approved by the workshop council. Once your workshop is submitted, it will be sent to the workshop council. The workshop council will approve your workshop or ask for more details within 3 business days through email. If you have not heard back from your council group after 3 business days, please email them to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com). Once approved, you will be entered into the workflow and given additional steps to progress through to production.

## Task 2: Understand the Workshop development workflow

Once your workshop is **Approved**, development starts with using the sample template or another similar workshop. Before you get going, there are some LiveLabs standards, things to keep in mind and plan for while developing that we will discuss here. Setup of the environment is in the next lab.

There are different ways to deploy your workshop. It can run in a free tier account or in a paid account.

There are different ways to deploy your workshop. It can run in a free tier account, paid account and LiveLabs sandbox. How to deploy in these options will be discussed later but you should be thinking of how to keep resources in a compartment and other resources that would be needed to run in the LiveLabs sandbox.

1. Development standards
**Naming standards** - File names should all be lower case, which means markdowns, images, csv, etc., basically all of the workshop files including folders. Match the folders and file names where possible. Also be descriptive, not just step numbers or auto-generated names.
**Titles** - Start titles with imperative verbs, keep short, concise and consistent.
**Lab Sections** - Each labs has a title and objectives and then tasks.
**Screenshots** - Keep screenshots in one folder - images. Keep them clear and big, which means trimming whitespace and using what is needed in the screenshot. Blur out personal/sensitive information. Provide alternate text as part of the markdown (described in detail later) but this is for accessibility.

## Task 3: Workshop development workflow

Now that you understand the general workflow workflow and approvals involved, it is time to get started with developing the content. In the next couple of labs we will walk through the details of using GitHub and Markdown content but the following steps show the general workflow process that you need to follow to set up your environment to develop labs and workshops. Most of the tasks are performed only once, but there are others that will be repeated and you can use your configured environment to develop other new workshops.

This is the overview of the steps, and in the next lab these topics will be covered to walk you through setting up your environment, writing and editing and QA of your workshop to get it ready to publish.

1. Create, set up, and access GitHub account
2. Install GitHub Desktop
3. Install and use Visual Studio Code
4. Fork repositories from [oracle-livelabs/partner-solutions](https://github.com/oracle-livelabs/partner-solutions)
5. Clone the repository that you forked
6. Create your workshop's folder structure
7. Create content using Visual Studio Code and the [sample workshop template](https://github.com/oracle-livelabs/partner-solutions/tree/main/sample-livelabs-templates/sample-workshop)
8. Review content by Oracle LiveLabs team
9. QA your workshop
10. Deploy completed content to the oracle-livelabs/partner-solutions main branch

Ready to publish!

>**Note:** If you want more information about how to perform each step above, click on labs on the left.

This concludes this lab. You may now **proceed to the next lab**.

## Acknowledgements

* **Author** - Anoosha Pilli, Product Manager, Database Product Management
* **Last Updated By/Date:** Anoosha Pilli, September 2022