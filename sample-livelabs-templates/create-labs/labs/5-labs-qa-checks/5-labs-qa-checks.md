# QA checks and steps

## Introduction

Quality checks and review of your workshop are to ensure the users enjoy the workshops and provide the best experience with the Oracle technologies. Some of the QA steps are to ensure the LiveLabs standards, and hopefully most of these checks have been done throughout the development of the workshop.

### Objectives

* Request for a review
* Test your content

### What Do You Need?

* Git Environment Setup
* GitHub Desktop client

This lab assumes that you have completed **Lab 4: Develop Markdown and content** in the **Contents** menu on the left.

Watch this video below on how to self-QA your workshop.
[](youtube:8tirP-hibsk)

## Task 1: Share your Workshop for Review

After you have successfully set up your GitHub pages, you can share your **Development GitHub URL** of the workshop for review.

To share and view your workshop:

1. In the new tab of the browser, type or paste the URL of your GitHub Pages site.

2. Then append the URL with the path to the index.html file in either tenancy or desktop or sandbox version in the workshops folder of your workshop for the version you want to share the link for review. This link will be your **Development GitHub URL**.

	For example, if anooshapilli user wants to share the tenancy version of sample-workshop in the partner-solutions repository for review, the user would append their GitHub Pages URL - [https://anooshapilli.github.io/partner-solutions/](https://anooshapilli.github.io/partner-solutions) with the path to index.html file in tenancy folder - **partner-solutions/sample-livelabs-templates/sample-workshop/workshops/tenancy/index.html**. Then the complete URL will look similar to this [https://anooshapilli.github.io/partner-solutions/sample-livelabs-templates/sample-workshop/workshops/tenancy/index.html](https://anooshapilli.github.io/partner-solutions/sample-livelabs-templates/sample-workshop/workshops/tenancy/index.html) which can be shared for review.

## Task 2: Change your status

Now that your workshop is inside the Oracle LiveLabs GitHub project, confirm the LiveLabs council about your workshop status by emailing us to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com).

1. If you still have some workshop development or changes to do, the LiveLabs council will update the status of the workshop to **In Development**.

2. If you are finished with the workshop development and ready to perform QA (details in Task 8 of this lab), the LiveLabs council will update the status of the workshop to **Self QA**.

3.  If your workshop is already in production, and want to make minor changes to your workshop, you will need to mail us to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com) to edit it.

## Task 3: Self QA

You have finished developing your workshop. To publish your workshop, you still need to perform self-QA on the workshop. If there are changes to the details below, email us to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com) to keep the system updated.

1.  Make sure the **Workshop Title** you submitted while requesting a new workshop matches with the workshop title in development, and the details provided in **Short Description**, **Long Description**, **Workshop Outline**, **Workshop Prerequisites**, **Publish Type**, **Workshop Environment** and **Workshop Time** fields are still valid. These are the details that will be displayed on the workshop homepage when the workshop is live.

2.  Share us the **Development GitHub URL** which is the link to your workshop in your personal GitHub Pages site that we identified at Task 4. After your workshop has been added to oracle-livelabs/repository (your pull request has been merged), we will update our records with the **Production GitHub URL**. You can construct the Production URL by replacing your username in the **Development GitHub URL** with **oracle-livelabs** that we identified in Task 6.

3. Confirm if the **Level**, **Role**, **Focus Area**, and **Product** tags details shared with us while submitting the workshop are up-to-date. Tags help people find your workshop in LiveLabs.

4. Download this [Self QA document](https://objectstorage.us-ashburn-1.oraclecloud.com/p/MKKRgodQ0WIIgL_R3QCgCRWCg30g22bXgxCdMk3YeKClB1238ZJXdau_Jsri0nzP/n/c4u04/b/qa-form/o/QA.docx). To align with the LiveLabs standards, check your workshop against the form, make changes to your changes to your workshop as needed and fill out the form. Create a new pull request if necessary with the changes made.

	Workshop author or the team can watch the video below on how to self-QA or verify QA of the workshop.

	[Self QA](youtube:8tirP-hibsk)

5. Confirm us the above details in task 8, the status of your workshop if the self QA is completed and email us the completed Self QA document to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com). Once we have these details we will update the status to **Self QA Complete**.

## Acknowledgements

* **Author** - Anoosha Pilli, Product Manager, Database Product Management
* **Last Updated By/Date:** Anoosha Pilli, September 2022
