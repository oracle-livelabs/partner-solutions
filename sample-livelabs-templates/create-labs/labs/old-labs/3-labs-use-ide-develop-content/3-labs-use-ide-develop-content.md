# Use A Text Editor to Develop Markdown Content

## Introduction

Oracle LiveLabs has a set folder structure that you will need to follow for developing your workshops. The folder structure is only part of the development since the workshop content is contained in the Markdown files and images that you write and edit as your workshop development. You can use your preferred editor to author and edit your Markdown (.md) content for rendering the Workshop output.
If you are new to Git and Github, we recommend using Github Desktop to maintain your repository.
**Of course, you can use any IDE or Git tool of your choice**

### Objectives

* Install Visual Studio Code and Github Desktop to 
* Clone and fork Oracle LiveLabs GitHub repositories.
* Familiarize yourself with the components of the workshop and the lab folders.
* Learn about the tools that are available to develop and host your content.
* Learn how to merge content.

## Task 1: Fork Repositories of the oracle-livelabs Project on Your GitHub Account

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

## Task 2: Clone the Forked Repository

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

## Task 3: Merge Content from Git Before You Start Editing Your Content

Every day before you start editing your content, ensure to do a merge from upstream.
You can do that using your `git` on the command line or GitHub Desktop.

**Please note:** We provide documentation only on using Github Desktop. If you are familiar with Git, you can use Git also on the command line.

Merging synchronizes the content in your cloned repository with the latest content on the **upstream/main** repository and ensures that you have the most recent versions of the templates and other workshops/labs.

> **Note**: If you do not do that, you may get merge conflicts later when you commit your changes, which can be complex to fix.

To merge content using Github Desktop:

1. Start your **GitHub Desktop** client.

2. If you have multiple repositories, first switch to the repository that you will work on. Expand the dropdown list of **Current Repository**. Click the **partner-solutions** repository to sync.

	In this example, we are selecting the em-omc repository, but the following process is the same for syncing your repository.

  ![Switch repository.](./images/switch-repo.png " ")

3. Make sure you perform the following steps **off VPN**. Otherwise, your GitHub Desktop may be stuck.

4. Click **Fetch origin**.

  ![Fetch origin.](./images/fetch-origin.png " ")

5. Select **Branch > Merge into Current Branch...** to display the **Merge into main** window.

    ![Merge current branch.](./images/git-hub-merge-current-branch.png " ")

6. Under the **Default Branch**, the main branch is selected by default. This indicates the local clone on your PC.

    ![Main branch is selected by default.](./images/git-hub-merge-local-clone-default-branch.png " ")

7. Scroll down the **Merge into main** window, select **upstream/main** (this is your production repository which is oracle-livelabs/partner-solutions repository), and then click **Create a merge commit**. In this example, this will create 1 merge commit with the changes you fetched and merged from the **upstream/main** into the clone on the local PC.

    When the merge is completed, a **"Successfully merged upstream/main into main"** message is displayed.

    ![Create a Merge Commit.](./images/create-merge-commit.png " ")

8.  To push the new commits from the local clone to your forked location, click **Push origin**.

    > **Note:** If you get an *Authentication failed* error, refer to the Lab 6 - GitHub FAQ.

    ![Push Origin.](./images/push-origin.png " ")

9.	To determine if your clone is up-to-date with **upstream/main** (production), repeat Steps 4 to 7. If both repositories are synchronized, then the following message is displayed: **This branch is up to date with upstream/main**.

    ![This branch is up to date.](./images/git-hub-merge-branch-up-to-date.png " ")

  In the **GitHub Desktop** UI, notice that the **Push origin** is replaced by **Fetch origin** after the push origin operation is completed.  The local clone and fork repositories are now synchronized with the main repository.

  ![Synchronized repositories.](./images/fetch-origin.png " ")

## Task 4: Create Your Labs and Workshop Content

Leverage the content from the **sample-livelabs-templates/sample-workshop** folder to start creating lab and workshop content for your project.

> **Note:** Make sure to update your clone from the **upstream/main** repository (detailed in **Task 3** of this lab) regularly whenever you are working on the markdown files.

To create your lab and workshop content:

1. Make sure you have submitted your workshop request (see details in Lab 1 -> Task 1) to [livelabs-help-community_us@oracle.com]( livelabs-help-community_us@oracle.com) **BEFORE** you begin development.  *No GitHub requests will be approved without the approved workshop ID.*

2. Open your cloned repository using Windows Explorer (Windows) or Finder (Mac).

3. Create your project folder with a name on the parent level in your cloned repository.

4. Go to **sample-livelabs-templates/sample-workshop**. This has a few lab folders, such as **provision**, **query**, etc. Every lab folder contains the following: a **files** folder, an **images** folder, and the respective `.md` file. If you open this folder in your editor, you can use **Live Server** (steps in task 6 of this lab) to open up **sample-workshop/workshops/tenancy/index.html** to see how a workshop will show up in production, and play with it.

5. Copy any lab folder (except the folder named `workshops`), such as the **query** folder, to your project folder. In your project folder, rename the folder **query** and its respective `.md` file within it as per your requirement. Based on the sample **query** folder, you can create and rename as many labs (folders) and the respective `.md` files as per your requirement.

    > **Note:** The **files** folder within every sample lab folder is currently not required and is reserved for future use. You can remove it if you do not need it.

    ![Files folder with sample labs.](./images/lab-files-folder-currently-not-needed.png " ")

    After you copy the sample folder to your project folder, if you delete your copy of the **files** folder from your project folder, your lab folder will look similar to this example:

	![Example of your lab files folder.](./images/lab-folder-structure.png " ")

6.	To add an introduction to your workshop, then navigate to **sample-livelabs-templates/sample-workshop** folder and copy the `introduction` folder to your project folder. You can rename the introduction folder if you would want to.

7. Similarly, navigate to the **sample-livelabs-templates/sample-workshop** folder and copy the entire **workshops** folder along with its contents from **sample-livelabs-templates/sample-workshop** to your project folder.

8. To edit the `.md` file of your lab, open your text editor (in this case, we are using Atom), click **File > Open Folder** to display the **Open Folder** dialog box. In VS Code, you would click **File > Open**. Navigate to cloned project folder and select your project folder to open in the editor.

  ![Open project folder in Atom.](./images/use-atom-editor-open-folder.png " ")

9.	The project folder along with the **labs** and **workshops** folder will be displayed in your text editor. In this example, **sample-livelabs-templates/create-labs/labs** folder is opened.

    ![Workshops folder displayed in text editor.](./images/atom-editor-project-folder-displayed.png " ")

10. Select the `.md` file you want to edit, for example, select the `1-labs-git-hub-get-started-install-configure.md` file and edit your lab content. Similarly, edit the `.md` files of the rest of your labs.

    ![Select markdown file to edit.](./images/atom-editor-browse-open-mdfile-editing.png " ")

11. If you want to add images in your lab, then include them within the **images** folder. You can insert images in the respective `.md` file.

12. Similarly, to edit your workshop content, expand the **workshops/tenancy** (if you are creating a workshop running on users' tenancies), **workshops/sandbox** (if you are creating a sandbox/green button workshop), and/or **workshops/desktop** (if you are creating a noVNC workshop) folder in your text editor. Edit the `manifest.json` to list the labs you have added to your workshop (or plan to add) and update the title of the workshop. The `manifest.json` is like your book map file in SDL.

	Besides the list of labs, also update the `workshoptitle` field, and update the `help` field to point to the `livelabs-help-community_us@oracle.com` email. If the `include` and `variables` field do not apply to your workshop, please remove them, otherwise, your workshop will not render properly.

	![Edit manifest json file with Atom.](./images/manifest.png " ")

13. You can also create a `README.md` file within **workshops/freetier**, and update the `README.md` with a summary of your workshop. Note that the `README.md` file is optional for your workshop.

## Task 5: Security

1. Blur all personal information (IP addresses, intranet URLs, email addresses, OCIDs, usernames, and passwords) from images.

  ![Blur all identifiable information.](./images/blur-ip.png " ")

2. Every image must have a description: ![DESC] (…/…/name.png “ “)

  ![Every image must have a description.](./images/image-desc.png " ")

3. Do not use any IP addresses, intranet URLs (for example links to a Confluence page), email addresses, OCIDs, usernames, or passwords in the text. Do not provide a demo password.

## Task 6: Preview Your Workshop and Labs Using Live Server

### Using Visual Studio Code**

1. Within the directory of any workshop you want to view, click the **workshops** folder and then click the **freetier** folder.

  ![Navigate to freetier folder.](./images/folder-nav.png " ")

2. Right-click on the index.html file and select **Open with Live Server**.

  ![Right click and select open with the Live Server.](./images/right-click.png " ")

3. The local version of your workshop will then be launched in your web browser.

> **Note:** If your workshop or labs do not show up using Live Server and you see a blank page, check the manifest.json file.

1. Expand the navigation menu on the left, if you can navigate to other labs, then the problem is with a particular lab. Find that lab's location in the manifest.json file and fix the path to that lab's file.

2. If no labs are showing up, then it is possibly the issue with the workshop. In the manifest.json file, make sure you remove the *include* and *variables* if they do not apply to your workshop.

This concludes this lab. You may now **proceed to the next lab**.

## Want to Learn More?

* [Download and Install Git for Windows](https://git-scm.com/download/win)
* [Download and Install Git for Mac](https://git-scm.com/download/mac)
* [Download Visual Studio Code](https://code.visualstudio.com/download)

## Acknowledgements

* **Author** - Anoosha Pilli, Product Manager, Database Product Management
* **Last Updated By/Date:** Anoosha Pilli, July 2022