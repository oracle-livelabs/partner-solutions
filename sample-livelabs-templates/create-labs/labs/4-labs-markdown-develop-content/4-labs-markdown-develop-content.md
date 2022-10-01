# Develop Markdown Content

## Introduction

Using VSCode or another editor of your choice, the Markdown files need to be edited based on your workshop content. As you learned in the previous lab, there are templates that are provided to get you started.

> **Note:** Oracle recommends using **Visual Studio Code (VSCode)**.

### Objectives

* Create workshop and lab content.
* Link to absolute path images
* Use conditional formatting
* Add videos and scale images
* Use the LintChecker
* **IMPORTANT!** Case sensitivity

### What Do You Need?

* An IDE, such as Visual Studio Code.
* A local web server such as **Live Server** for VS Code.

## Task 1: Create Your Labs and Workshop Content

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

## Task 2: Security

1. Blur all personal information (IP addresses, intranet URLs, email addresses, OCIDs, usernames, and passwords) from images.

  ![Blur all identifiable information.](./images/blur-ip.png " ")

2. Every image must have a description: ![DESC] (…/…/name.png “ “)

  ![Every image must have a description.](./images/image-desc.png " ")

3. Do not use any IP addresses, intranet URLs (for example links to a Confluence page), email addresses, OCIDs, usernames, or passwords in the text. Do not provide a demo password.

## Task 3: Link to Absolute Path Images

Rather than pointing to images within your lab folder or workshop directory with a relative path, you can just as easily point your images to URLs. This comes in handy if you reuse an image a lot, the code you write to display it in markdown will always be the same no matter where the image is in relation to markdown. Using absolute image paths is also handy if you need to keep an image updated, as changing the destination file image will affect every instance where you pointed an image to it. This is the same concept and implementation as using absolute paths for common labs in your manifest.json files.

*For screenshots of OCI menu navigation, use the images with absolute links.*

1. Here is an example of what the image code looks like for pointing to a local image using relative path -

  ![Image relative path](./images/image-relative-path.png " ")

2. To use an image with an absolute path, just replace the path with an URL. In this case, I am pointing to a common image located in a different repository.

    ```
    <copy>
    ![Description](https://objectstorage.us-phoenix-1.oraclecloud.com/p/SJgQwcGUvQ4LqtQ9xGsxRcgoSN19Wip9vSdk-D_lBzi7bhDP6eG1zMBl0I21Qvaz/n/c4u02/b/common/o/images/console/home-page.png " ")
    </copy>
    ```

    Here is how the image path above shows up in production:

    ![Description](https://objectstorage.us-phoenix-1.oraclecloud.com/p/SJgQwcGUvQ4LqtQ9xGsxRcgoSN19Wip9vSdk-D_lBzi7bhDP6eG1zMBl0I21Qvaz/n/c4u02/b/common/o/images/console/home-page.png " ")

3. If the image link breaks, the image will break. For this reason, it is recommended that you use the Object Storage link rather than a random image hosting site.

## Task 4: Use Conditional Formatting

If your workshop supports multiple instance types, but the bulk of the content stays the same, then conditional formatting can save you a lot of work. Most commonly, if you have differences between the "Tenancy" and "Sandbox" versions, like having elaborative instructions on provisioning a database instance in tenancy version and just verifying the database setup instructions in the Sandbox version. Then conditional formatting will help your workshop to use a singular markdown for both. This will save you immense effort and prevent accidental oversights if you need to update your workshop in the future since you won't have to maintain a duplicate markdown.

1. Conditional formatting is using the "if" conditional to choose what to display in your markdown, based on an additional attribute "type" you attach to a lab element in your manifest.json file. Take a look at this example to understand the components involved in making conditional formatting work.

	In the below image, on line 71, you can see the conditional is **if type="freetier"** and the closing **/if** on line 92. That means line 71-92 is only rendered if the type is freetier, and lines 93-98 is only rendered if the type is livelabs.

  	![Example of conditional formatting.](./images/conditional-vsc1.png " ")

  	In the screenshot below, on freetier (now renamed to tenancy) folder's manifest.json file lines 21 and 27, you can see that we added the attribute **"type:" "freetier"** to the lab element. In this instance, this manifest.json is for the free tier version of the workshop. So, when a customer launches the workshop through the run on your tenancy button on the workshop's landing page, lab 2, and lab 3 will always display the content inside the **"freetier"** type in the above screenshot.

  	![Code is only rendered if condition is met.](./images/freetier.png " ")

	Similarly, in the screenshot below, on livelabs's (now renamed to sandbox) folder manifest.json file lines 12, 17, and 23, you can see the same thing except that it is **"type:" "livelabs"** for the livelabs version of the workshop. So, when a customer launches the workshop through the Run on LiveLabs button on the workshop's landing page, introduction lab, labs 1, and lab 2 will always display the content inside the **"livelabs"** type in the first screenshot of this task.

  	![Freetier version type.](./images/livelabs.png " ")

	The actual word doesn't matter, as long as the "type" in the manifest.json and the "type" in the markdown matches, the contents of the markdown conditional will be displayed.

2. You may have noticed that the numbering of the substeps within a step that uses conditional formatting may get out of line. Don't worry, as long as you use a number greater than 0, markdown will automatically number them sequentially when it gets rendered on a webpage. Also, note that conditional formatting can be used in-line if needed, you don't **HAVE TO** envelope content in a neat code block... though it's recommended to keep things organized and easy to read.

  ![Recommended to keep code block organization.](./images/conditional-note.png " ")

## Task 5: Link within a Workshop (Hotlinks)

Sometimes you may want to link to something within your lab or workshop.  Most commonly, this is used in pages to link from the introduction or objectives to a specific section in the lab. This section in particular is hot-linked from the introduction to driving home that point. We'll take a look at the "Need Help?" lab to demonstrate how to incorporate this in your workshop.

1. First, take a look at the format of the hotlink. It's the same as when you construct a regular hyperlink, except that you preface the URL section with a **#** and then you use a seemingly condensed version of the section name you want to link to.

  ![Example of a hotlink.](./images/hotlink-vsc.png " ")

2. The condensed version of the section name is derived from the title of the section, without any spaces and most punctuations. This is the **name** attribute of the section (**division** in this case, and most cases). To view this and ensure your hotlink is correct. Right-click on the element you want to link to and select **Inspect Element** and find the **"Name"** attribute.

  ![Inspect element of a hotlink.](./images/hotlink-element.png " ")

## Task 6: Add and embed Videos

Adding videos is very similar to adding images. We most commonly see videos added in the introductions for labs to familiarize the audience with the product before they dive into the workshop.
LiveLabs supports embedding of videos from [YouTube](https://www.youtube.com) or [Oracle Video Hub]([https://https://videohub.oracle.com/).

### Embedding a video from Oracle Video Hub (recommended)

1. Take a look at his example of a video hosted on Oracle Video Hub in this lab.

  ![The Video Hub markdown](images/videhub-markdown.png =60%x* " ")

  The embedded video looks like this: 

  [Video hosted on Oracle Video Hub](videohub:1_2ubr9fo8)

  Markdown does the work of embedding the video for you, all you need to provide is a video hosting site and the video link address.

2. You can find the video identifier code in the URL (in this example, the code is **1_2ubr9fo8**).

  *Please note:* Oracle Video Hub identifiers are usually prefixed with either `0_` or `1_` followed by a unique code.

  ![The Video Hub URL](images/video-hub-url.png =60%x* " ")

### Embedding a video from YouTube

1. Take a look at this example of a video linked in the introduction of a workshop.

  ![Example of a video link.](./images/youtube-vsc.png =60%x* " ")

  Markdown does the work of embedding the video for you, all you need to provide is a video hosting site and the video link address.

2. The video link address is the characters you'll find at the end of the URL for the video you want to link.

  ![How to link a youtube video.](./images/youtube-url.png =60%x* " ")

## Task 7: Scale an Image

Without using image scaling, all the screenshots you take for your workshop will be of different sizes (unless you're a master of making pixel-perfect crops). To remedy this, we HIGHLY recommend you to stick with a scaling and use it throughout your workshop. This will make all the images scale to the same width (if possible) and contribute to a more consistent and polished feel. You can override the default image scaling by applying these manual controls below. **We highly recommend you use #4's format by default.**

1. This is a demo image with no image sizing applied:

    ```
    ![](images/livelabs-homepage.png)
    ```

  ![Demo image with no sizing.](images/livelabs-homepage.png)

2. Use this format to scale the image size in relation to the amount of lab page space available. This example uses 50% of the page width and auto height:

    ```
    ![](images/livelabs-homepage.png =50%x*)
    ```

  ![Use this format.](images/livelabs-homepage.png =50%x*)

3. Use this format for an absolute width and auto-scaled height. This example uses 500 pixels for width:

    ```
    ![](images/livelabs-homepage.png =500x*)
    ```

  ![Absolute width and auto-scaled height.](./images/livelabs-homepage.png =500x*)

4. Lastly, **this is the format we recommend for all your images** if you don't need a particular scaling to drive emphasis on a subject. It auto-scaled to around ~3/4ths of the page width and its definition is maintained by the LiveLabs team so we can adjust the scaling platform-wide if needed:

    ```
    ![](images/livelabs-homepage.png " ")
    ```

  ![Recommended format for all images.](./images/livelabs-homepage.png " ")

5. As a final note, it's in your best interest to take as large of a picture as you can and then scale it down using the parameters above. LiveLabs allows the magnification of images so if you have a larger base image, the audience will have more clarity.

## Task 8: Use the LintChecker

The LintChecker is a great javascript function for QAing that you should take advantage of. It is especially handy in catching some of the more easily overlooked errors such as indentation and syntax errors.

1. To enable the LintChecker, just append **?qa=true&** to the URL after the freetier/ or livelabs/. You can do this from the github.io webpage or through LiveServer in your chosen IDE.

  ![Enable LintChecker.](./images/lintchecker.png " ")

  A box will pop up with any errors that the LintChecker caught. Keep in mind that these are not an exhaustive list of errors, they are only the ones that the function has been programmed to catch.  Also keep in mind that even though it lists something as an "error", if it was done intentionally by you, you can by all means just ignore it.

## Task 9: Case Sensitivity

**THIS IS IMPORTANT.** The majority of us use Windows and macOS which are **Case Insensitive** systems. This means that Windows and macOS consider "OrAcLe.PnG" to be the same as "oracle.png" or "Oracle.PNG" for file structure. GitHub and GitHub pages are **Case Sensitive**, and **do** make that distinction.

1. This means that, for example, if you had an image file that you tested locally (on LiveServer for your IDE on your local Windows or macOS machine) for a markdown called "case-sensitive.png", it would display just fine if you used "case-sensitive.png" or "case-sensitive.PNG" as the image link.  But if you viewed it up on GitHub pages at [this link](https://objectstorage.us-phoenix-1.oraclecloud.com/p/SJgQwcGUvQ4LqtQ9xGsxRcgoSN19Wip9vSdk-D_lBzi7bhDP6eG1zMBl0I21Qvaz/n/c4u02/b/common/o/sample-livelabs-templates/create-labs/labs/workshops/freetier/index.html?lab=3a-labs-misc-develop-content-features), only the "case-sensitive.png" image link would be displayed since it matches the image file name perfectly (case sensitive) and it could not find the image link for "case-sensitive.PNG" and so it cannot display it.

  ![Proper case format.](./images/case-sensitive.png " ")

  ![Improper format.](./images/case-sensitive.PNG " ")

  Do you see one or two images above?

  If you are viewing this page via LiveServer from your IDE (on a case insensitive operating system), you should see **two** images.

  If you are viewing this page on github.io, you should only see **one** image.

2. If you do run into a Case Sensitivity error on Windows or macOS, you cannot simply fix it by renaming it DIRECTLY with the correct case... because the system will not recognize that you are trying to rename it. You have to either rename that item to something else entirely and then rename it back with the correct case... or you can use **"git mv"** as described [in this article](https://stackoverflow.com/questions/11183788/in-a-git-repository-how-to-properly-rename-a-directory) for more complicated fixes that involve entire directories.

## Task 10: Code Snippets

1. If you include code snippets in your workshop instruction, you can use the following syntax for code to distinguish it from other instructions.

    ![Code Snippet](./images/code-snippet.png " ")

    ```
    some code
    ```

2. If you want users to copy this code snippet, you can add the *copy* tag around the code.

  ![Add copy tag for code snippet](./images/code-copy.png " ")

    ```
    <copy>
    some code
    </copy>
    ```

3. If you specify the language of the code, Markdown can recognize the syntax and highlight certain information.

    ![Add json tag for code snippet](./images/json-code.png " ")

    ```json
    {
      "firstName": "John",
      "lastName": "Smith",
      "age": 25
    }

    ```
    ![Add java tag for code snippet](./images/java-code.png " ")
    ```java
    System.out.println("Hello World");
    ```

4. If you do not want anything highlighted in your code snippet, simply add the `text` tag.

    ![Add text tag to remove all highlighting](./images/text.png " ")
    ```text
    {
      "firstName": "John",
      "lastName": "Smith",
      "age": 25
    }
    ```

## Task 11: Useful Markdown Syntax Cheatsheet

1.	Download this handy [Cheatsheet](https://objectstorage.us-ashburn-1.oraclecloud.com/p/Qfg5WZ_O9yDet7NlaJPT76s9o_Yy0VVQ3LDh34c0HTrietIqqKq-m9zukdqiRymL/n/c4u04/b/livelabsfiles/o/LiveLabs_MD_Cheat_Sheet.pdf), which has more information about using Markdown syntax for LiveLabs development.

This concludes this lab. You may now **proceed to the next lab**.

## Acknowledgements

* **Author** - Anoosha Pilli, Product Manager, Database Product Management
* **Last Updated By/Date:** Anoosha Pilli, September 2022