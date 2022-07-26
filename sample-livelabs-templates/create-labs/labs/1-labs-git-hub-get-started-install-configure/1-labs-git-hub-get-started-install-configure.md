# Get Started with Git and Set up the GitHub Environment

## Introduction

In this lab, you will learn how to create a GitHub Account and associate it with your email account, set up the GitHub development environment, and install GitHub Desktop.

### Objectives

* Submit a LiveLabs workshop request through email
* Create a GitHub account and add it to the Oracle GitHub Organization.
* Set up your GitHub environment.
* Install GitHub Desktop Client.

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

2. Provide the *Social* details like share a link to the blog of your workshop, write a couple of sentences that would accompany a LinkedIn post about your workshop, and write a tweet (limit 240 characters) to be used to promote your workshop.

We recommend you do not start working on your workshop until your workshop has been approved by the workshop council. Once your workshop is submitted, it will be sent to the workshop council. The workshop council will approve your workshop or ask for more details within 3 business days through email. If you have not heard back from your council group after 3 business days, please email them to [livelabs-help-community_us@oracle.com](livelabs-help-community_us@oracle.com). Once approved, you will be entered into the workflow and given additional steps to progress through to production.

## Task 2: Create and Set Up Your GitHub Account

In this Task, you will create and set up your GitHub account.

1. Create a free GitHub Account here: [GitHub Web UI](https://github.com/) if you don't have one.

    ![Download Git](./images/git-download-install-create-account.png " ")

2.  If this is a new account, use your email ID to register.

    > **Note:** Do not create a secondary new account to join GitHub.

3. Go to [GitHub Settings](https://github.com/settings/profile) and configure the following:
    *   Set your Name.
    *   Add your Profile Picture.

4. Click **Account** to add your user name in the **Enter a user name** dialog. For example, johnhall.

5. We recommend setting a 2 Factor Authentication here: [GitHub Security](https://github.com/settings/security).

## Task 3: Download and Install the latest version of Git (Optional Step)

> **Note:** Oracle recommends using the GitHub Desktop client because of its simple and user-friendly user interface, and it is also much easier to use than the Git command line. Therefore, skip this task and follow the instructions in **Task 4: Install GitHub Desktop** if you are not familiar with command-line interface.

To install Git:

1. Install Git for your operating system from the [Git download site] (https://git-scm.com/downloads).

2. Click the required option under **Downloads** (**Windows** in this example) and save the installer file.

3. Browse to the downloaded location and double-click the file to launch the installer.

4. Click **Yes** in the **User Account Control** dialog box.

5. Click **Next** in the **GNU General Public License** dialog box.

6. Under **Choose the default behavior of `git pull`**, leave the selected **Default (fast-forward or merge)** option as is and click **Next**.

7. In the **Configuring experimental options** dialog box, click **Install**.

## Task 4: Install GitHub Desktop

The GitHub Desktop application is a UI client for Windows and Mac that simplifies the complex set of GitHub command line arguments. GitHub Desktop is a fast and easy way to contribute to projects and it simplifies your development workflow. It is much easier than using the Git command line.

To set up the GitHub Development Environment and install **GitHub Desktop**:

1. Download and install **GitHub Desktop** from [GitHub Desktop](https://desktop.github.com/).

2. When the software is successfully installed, open the **GitHub Desktop**.

  ![GitHub desktop login screen.](./images/git-hub-desktop-login-screen.png " ")

3. Click **File > Options > Sign in**, enter your GitHub **Username** or **email address**, **Password**, and then click **Sign in**. You will receive an authentication code sent to your cell phone. Enter this code in the **Authentication code** field in the **Sign in** dialog box.

    > **Note:** The authentication code is valid only for a few seconds.

	You are now logged in to **GitHub Desktop**.

  ![GitHub desktop main screen.](./images/get-started-git-hub-desktop.png " ")

## Task 5: Fork Repositories of the oracle-livelabs Project on Your GitHub Account

After your workshop is approved by the council group, you will be creating your workshop and labs in the [oracle-livelabs/partner-solutions](https://github.com/oracle-livelabs/partner-solutions) repository of the **oracle-livelabs** project. You must fork the repository to create a duplicate personal copy of the repository on your GitHub account. You own the forked (stage) repository, and you can edit its contents without affecting the parent (production) repository.

For example, if a user named **anooshapilli** forks the [oracle-livelabs/partner-solutions](https://github.com/oracle-livelabs/partner-solutions) repository in the **oracle-livelabs** project, a duplicate repository [anooshapilli/partner-solutions](https://github.com/anooshapilli/partner-solutions) is created.

To create a workshop in the [oracle-livelabs/partner-solutions](https://github.com/oracle-livelabs/partner-solutions) repository, you need to fork the **partner-solutions** repository. The following steps walk you through forking the **partner-solutions** repository, in the oracle-livelabs GitHub project.

1. Log in to the [GitHub Web UI](http://github.com), using your GitHub account.

2. Navigate to the [oracle-livelabs/partner-solutions](https://github.com/oracle-livelabs/partner-solutions) repository.

3. Click **Fork**.

	In this example, we are forking the goldengate repository but the following process is the same for forking your **partner-solutions** repository.

  ![Fork](./images/fork.png " ")

4. Under **Owner**, expand the dropdown list and select your username. You can accept the **Repository name** as it is. Click **Create fork**.

  ![Create fork](./images/create-fork.png " ")

5. Then, your user has forked the **partner-solutions** repository.

	As you can see, arabellayao user has forked the goldengate repository.

  ![Local repository](./images/local-repo.png " ")

In the next task, you will clone this forked repository.

## Task 6: Clone the Forked Repository

A clone is a copy of your forked repository that lives on your local computer instead of on [GitHub Web UI](http://github.com). When you clone your forked repository, you can edit the files in your preferred editor, such as **Atom** editor, or **Visual Studio Code**, and use the **GitHub Desktop** client to keep track of your changes without having to be online.

To clone the forked **partner-solutions** repository:

1. Open your **GitHub Desktop** application and log in using your GitHub account.

2. Click **File > Clone repository** to display the **Clone a Repository** dialog box.

    ![Clone repository.](./images/git-hub-desktop-clone-repository.png " ")

3. Select your repository such as **your account/repo** from **Your Repositories**.  Under **Local Path**, select the local path on your machine where the repository is going to be cloned (copied). This is where the repository files get copied to your local file system. Click **Clone**.

	In this example, arabellayao/goldengate is selected.

    ![Available repositories dialog box.](./images/clone.png " ")

4. The cloning process may take several minutes, depending on how big the repository is.

  ![Cloning](./images/cloning.png " ")

5. When asked how you plan to use the fork, select **To contribute to the parent project**. Click **Continue**.

  ![Contribute to parent project.](./images/contribute-to-parent.png " ")

6. The repository files will appear in the local path you just specified. You can now start working on your labs and workshops!

	In this case, it is goldengate.

  ![Successfully cloned repository.](./images/git-hub-my-cloned-repository.png " ")

	Once you make a clone, you can create your project folder, edit the files in your preferred editor, such as **Atom** or **Visual Studio Code**, and use **GitHub Desktop** to keep track of your changes without having to be online.

	> **Note:** The repository you cloned (local version) is connected to the your fork (remote version) so that you can push your local changes to the remote to keep them synced when you are online.

7. You can also use Github Desktop to synchronize the changes that you have made in your local file system to the forked content on your GitHub repo. More details on using Github Desktop in Lab 4 of this workshop.

  ![Synchronize with GitHub.](./images/github-desktop-sync.png " ")

This concludes this lab. You may now **proceed to the next lab**.

## Learn More

* [Download and Install Git for Windows](https://git-scm.com/download/win)
* [Download and Install Git for Mac](https://git-scm.com/download/mac)

## Acknowledgements

* **Author** - Anoosha Pilli, Product Manager, Database Product Management
* **Last Updated By/Date:** Anoosha Pilli, July 2022