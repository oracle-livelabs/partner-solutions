# LiveLabs FAQ

## Introduction

For questions related to Oracle LiveLabs please review this FAQ. If you do not see an answer listed here, please email to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com).

## LiveLabs Production FAQ

1.	Is Oracle LiveLabs available to customers?
    -	Yes, it is available to everyone.
2.  How can I access LiveLabs?
    -   It is accessible globally. Search for Oracle LiveLabs on the search engine of choice, click on the apex link to go to LiveLabs homepage or you access by clicking this link [https://developer.oracle.com/livelabs/](https://developer.oracle.com/livelabs/)
3.	Who can run the workshops?
    -   Anyone can run the workshops.
4.	Is this cloud only?
    -	No, we have workshops On-Premises too.
5.	Do you support SAAS/PAAS for SAAS workshops?
    -	We do not support Saas/Paas for Saas workshops.
6.	What do you need to run the workshop?
    -   There are two ways, you can run a workshop in Oracle LiveLabs.
        -	Run on your tenancy – Customers do need a tenancy to run the workshop.
        -	LiveLabs sandbox tenancy - An account of any type registered with Oracle (Eg: Gmail) to sign into Oracle with SSO.
7.	How to look for a specific workshop to run?
    -	Search in [LiveLabs](https://developer.oracle.com/livelabs/). It is self-service.
    -	Click on **View All Workshops** button to look through the catalog or search the workshop using the Search bar on top.
    -   You can also filter the workshops based on the Level, Role, Focus Area, and Product, etc using the filter options on the left side of View All Workshops page.
8.	How to register for a workshop?
    -	Once you finalize the workshop you want to run, click on the workshop tile and click  **Start** button.
    -	Run on your tenancy:
        - If customers want to run the workshop on their own tenancies, click the **Run On Your Tenancy**.
        - Then you can view the workshop instructions to run through the workshop.
    -	Run on LiveLabs:
        - If you want to run the workshop on LiveLabs tenancy, click the Green button – **Run On LiveLabs**.
        - Provide credentials of the account registered with Oracle (SSO) and sign in.
        - On the Reserve Workshop dialog box, provide the **Attendee Timezone**, turn on the **Start Workshop Now** button, provide your public SSH keys if requested, check the **I consent to receive emails from LiveLabs for my reservation** checkbox, and click **Submit Reservation**.
        - On My Reservations page, once the provisioning is done, click **Launch Workshop** to view the workshop instructions and click on **View Login Info** on top of the workshop title to view the workshop reservation information.
9.	If I request a workshop, does it mean that the workshop will be able to run on Oracle's tenancy?
    -	Not all of the workshops have the "Run on LiveLabs" button to reserve a workshop enabled.
    -	It goes by what that particular workshop is configured to run on. e.g. If the workshop is configured to run on both freetier & paid, the workshop will have "Run on your tenancy" button.
10.	Is there a way to view the workshop instructions without reserving a workshop and securing an environment?
    -   Workshops and environments do not have to be reserved. All workshops can be executed on-demand on any kind of environment, freetier, or paid. Only certain workshops run and are pre-provisioned on an Oracle tenancy.
    -	A customer would not reserve an environment to execute a workshop on the freetier, it’s on-demand. Click on any of the **Run on Your Tenancy** button to view the workshop instructions.
11.	What to do if I am unable to launch a workshop's reserved tenancy using Run on LiveLabs button?
    -   If you are already logged into your own tenancy when clicking on the LiveLabs link, the LiveLabs reservation login link will skip the tenancy login (because according to the system you have already authenticated to your own tenancy) and tries to navigate to the assigned LiveLabs tenancy.
    -	Please make sure you are logged off completely from your own tenancy or use another (private) browser window to connect.
12.	How do I extend the LiveLabs tenancy workshop execution time?
    -	If you have an active reservation, you can extend the reservation of a workshop:
        - Navigate to My reservations page on [LiveLabs](https://apexapps.oracle.com/pls/apex/r/dbpm/livelabs/my-reservations?).
        - Click on **Launch Workshop** of the active reservation workshop that you want to extend.
        - Click on **Extend Workshop Reservation** button available on the top right corner of the Workshop below your username.
13.	What do I do if I have a feedback for a workshop? Whom to reach if I face errors running through the workshop? What to do if I have similar content and want to add more content to the existing workshop?
    -	Please mail us with the details to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com). The LiveLabs team will respond in 2-3 business days.
14.	What to do if I am looking for a Certification/Training?
    -	We have content that supports certification. Click on View All Workshops button on the LiveLabs homepage and you can shortlist the workshops based on Focus Area, Product, and other filters on the left-side of the page. Please check with Oracle University for certification assistance.
15.	How can I share a workshop link to customers?
    -	Share only the Apex URLs for the workshops in production. This helps in tracking the views for the workshop by counting the number of hits on the Apex URL of the workshop.
    -	Don’t share the github.io links, we do not track this URL and that may change.

## Workshop Development FAQ

1.	Who can submit a workshop?
    -	An Oracle Partner or Oracle ACEs, or the external community who is interested in developing a workshop demonstrating the features and products of Oracle can submit a workshop.
2.	How to submit a new workshop request?
    -	Email us your new workshop submit request (details in Lab 1 and Task 1) to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com).
3.	What is the process and ETA to hear from LiveLabs team about the status change from *Submitted* to *Approved*?
    -	Once the workshop is submitted, the workshop council team may update the workshop status to **More Info Needed** if they require more information to the workshop team via email; Otherwise, they will approve the workshop and move the workshop to **Approved** status and share you the ID of the workshop.
    -	Workshop Council is the team from Oracle LiveLabs that help you navigate the Development workflow.
    -	ETA to approve the workshop is 2-3 days. If you have not heard back from the council after 3 business days, please follow up with them.
4.  How to edit my workshop submission details / update the status of my workshop / have any questions related to Oracle LiveLabs GitHub project and oracle-livelabs/partner-solutions repository?
    -	Email us the changes to update / workshop status / your questions to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com).
5. Where can I locate the Self QA Checklist?
    -   When you are ready to Self-QA, mail us to change your workshop status to "Self QA.
    -   We will send an e-mail containing the Self QA Checklist. It can also be found [here](https://objectstorage.us-ashburn-1.oraclecloud.com/p/MKKRgodQ0WIIgL_R3QCgCRWCg30g22bXgxCdMk3YeKClB1238ZJXdau_Jsri0nzP/n/c4u04/b/qa-form/o/QA.docx).
6.	What binary files are not allowed in Github?
    -	The Oracle GitHub Organization wants to avoid executable files that can contain malicious code (PDFs, PSDs, ZIPs, JARs, WARs, EARs, BINs, EXEs) to host on Oracle GitHub projects.
7.	Where do I put my workshop files/objects?
    -	You can uploaded your files to you object storage or zip your files and mail to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com).
    -	LiveLabs team will upload the file in LiveLabs owned tenancy object storage and share the pre-authenticated link with an expiry date to you in 1-2 business days.
8.	How to submit videos for the workshops to one of the Oracle’s official Youtube channels?
    -	Workshop videos can only be sourced from one of the official Oracle Youtube channels.  We have a LiveLabs YouTube channel.  Submit the video to [livelabs-help-db_us@oracle.com](livelabs-help-db_us@oracle.com) and we will review and upload it.
9. What to do if there are GitHub related issues?
    -   Check the issues listed in the [Github troubleshooting](https://oracle-livelabs.github.io/common/sample-livelabs-templates/create-labs/labs/workshops/freetier/?lab=6-github-troubleshooting) lab. If you do not see answer to your issue listed in that lab, email us with the details and screenshot to provide you suggestions or next steps.
10.  Who is responsible for approving pull requests in the oracle-livelabs/partner-solutions repository of Oracle LiveLabs GitHub project?
    - LiveLabs Admin team is responsible for the oracle-livelabs/partner-solutions repository pull request approvals.
11.  What is the ETA to approve and merge the open pull request by LiveLabs admins?
    - ETA to respond/approve the pull request is 1-2 business days.
12. After my pull request is merged, how long does it take for the changes to be reflected in production?
    -   GitHub Pages site takes about 15-30 minutes to reflect the pages. Once the changes are reflected on the GitHub Pages site on oracle-livelabs/partner-solutions repository, the changes will also be live in production.
13.	What should I do if I am making major updates to the workshop in production?
    -	If the workshop is in production, and the updates are major (i.e. not fixes, spelling updates, revised screenshots, etc) let the LiveLabs Council to know about the changes and to update the workshop status back In Development.
    -	Create a new version of the workshop folder with the updated version
    -	Create new manifest copies of the changed files (i.e. setup.md is copied and called setup-v2.md)
    -	Proceed through the status’ like normal, submit Self QA.
    -	Once QA Verification is complete, we will point to the new workshop (this allows us to roll back to the earlier version if there is an issue).
14. What should I do if I am making minor updates to the workshop in production?
    - Make changes to your workshop and create a pull request.
    - After your pull request is approved, and your changes are reflected in the github.io page in 15-30 minutes.
    -   The workshop in production will be automatically updated.
15.	How to request for a green button?
    -	Email us if you wish to request the green button for your workshop. We will send you a questionnaire. Fill in the necessary details on the Green Button questionnaire and email us. Our team will work with you to create and test the green button.
16.	Do you create a green button for the workshops that require a Federated user?
    -  We do not configure the workshops that need federated users on LiveLabs tenancy as of now.
17.	Can we restrict the pool of regions where our lab runs to a subset of the supported regions – Green Button workshop?
    -	Yes, we can limit a workshop to specific regions for the workshops that run on LiveLabs tenancy.

## Acknowledgements

* **Author** - Anoosha Pilli, Product Manager, Database Product Management
* **Last Updated By/Date:** Anoosha Pilli, July 2022
