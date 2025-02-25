# Interact With ChatBot Application

## Introduction

We'll conclude this Live Lab with an exploration of various features within our imported APEX application that use various Oracle 23ai built-in generative AI features as well as explore how to use external AI providers to expand those capabilities.

**Estimated Time: 10 minutes**

### Objectives

In this lab, you will:

- Visualize patterns within the social media campaign's messaging via the *Graph Visualization Toolkit* (GVT) plug-in for APEX
- Identify messages with the most divergence between original and respondent postings
- Use generative AI tools to respond realistically to specific messages with different emotional tones and media formats

### Prerequisites

This lab assumes you:
- Have completed all previous labs successfully
- Are still connected to your APEX development environment as the **admin** user

## Task 1: Review Social Media Messaging Distribution
Let's take a quick look at some of the messages that were exchanged within our social media network. Each message's content as well as their relative positive or negative tone versus the originating message will be the focus of our planned response strategy.

1. Click on the *200 - Social Network* page to open that page.

  ![Choose page 200](images/open-page-200.png)

2. Click on *Run Page* icon next to the *Save* button near the top right of the page to run it.

  ![Run page](images/apex-run-page-button.png)

3. Since we are using *database account authentication* to connect our APEX application to the database, supply **hol23** for the login and the password (which, unless you have changed it, should be **Future1sNow#**).

![Connect APEX session](images/hol23-apex-login.png)

4. A graphic display of all messaging created as part of two different social media campaigns is displayed. Let's explore some of its visualization features.

  ![Exchanged messages overview](images/gvt-overall-view.png)

    Hover your mouse pointer over one of the messages that is a deep blue color near the center of the social media messaging threads displayed. If you click the right mouse button, you'll see some information about the message, its sender, and [ finish ].  

    ![Social media manager positive messaging](images/gvt-social-media-positive-01.png)

5. Note that responses that are generally more negative than the originally-posted messages are shaded grey, light red, or bright red.

  ![Respondent negative messaging #1](images/gvt-social-media-negative-01.png)

6. Now hover your mouse pointer over one of the messages that is a shade of deep red farther out on the peripherary of messaging threads displayed. If you click the right mouse button, you'll see some information about the message, its sender, and its polarity. Negative numbers represent message content that's derogatory or contains misinformation, and may even indicate the sender is a "troll." 

   ![Respondent negative messaging #2](images/gvt-social-media-negative-02.png)

7. Sign out of the application. This will return focus to the APEX *Edit Page* window.

![exitapplication](images/app-signout.png)

Unfortunately, we have limited time within this lab to explore the myriad features of the GVT plug-in. You can read more about it [here](https://docs.oracle.com/en//database/oracle/property-graph/23.3/spgdg/visualizing-sql-graph-queries-using-apex-graph-visualization-plug.html).

## Task 2: Configure OCI Generative AI Services
Now we'll configure our APEX application to use *OCI Generative AI* as its Generative AI Service provider.

1. Return to the *Home Edit* page for your APEX application and then click on the *Up arrow* in the top-left-hand corner. 

    ![Navigate Up](images/navigate-up.png)

    From this menu, click the *Workspace Utilities* option.

    ![Select Workspace Utilities](images/select-workspace-utilities.png)

    Then click on the *Generative AI* option.

    ![Select Generative AI Services](images/select-generative-ai-services.png)

2. A list of all configured Generative AI Services is displayed. Click the link for the one named *OCI Gen AI* to view its attributes.

    ![List Available Generative AI Services](images/list-generative-ai-services.png)

3. Adjust the attributes for the *OCI Gen AI* service that's already been configured for your application. 

    ![View OCI Generative AI Service Details](images/view-ocigenai-service-configuration.png)

    - Copy the value for *Compartment ID* that you saved in the previous lab into the *Compartment ID* field. 

    - Note that the *Region* is **us-chicago-1** and the AI model it's configured to use is **meta-llama-3.3-70b-instruct**. 
    
    - *No other changes are needed,* so now click the *Apply Changes* button.

4. Next, we'll reconfigure web credentials for the *OCI Gen AI* Service. Select the *Web Credentials* option.

    ![Select Web Credentials](images/select-web-credentials.png)

    The *OCI Gen AI* Generative AI Service uses the *OCI GenAI Credentials* web credential, so select that one.

    ![Select Credentials to Edit](images/select-web-credentials-to-edit.png)

    Modify the following values using the files you saved in the prior lab:

    - From the file you saved *in your editor of choice*, copy the values for *OCI User ID*, *OCI Tenancy ID*, and *OCI Public Key Footprint* into their corresponding fields.
    - From the file you saved *with a file extension of **PEM***, copy the entire private key string into the *OCI Private Key* field.
    - Click the *Apply Changes* button to save your modifications.

    ![Add OCI Gen AI Credentials](images/specify-ocigenai-service-web-credentials.png)

4. Return to the *Home Edit* page. Select the *Shared Components* option, then choose *Security Attributes* from the returned menu.

    ![Select Shared Components](images/select-shared-components.png)

    ![Select AI Attributes](images/select-security-attributes.png)

    Choose the *AI* option from the right-hand side of the top menu, and then choose *OCI Gen AI* as our AI Service provider. 

    ![Select OCI Gen AI Service Provider](images/select-desired-ai-provider.png)

    Note that while multiple external AI service providers can be configured for APEX, only **one** can be utilized for the entire application. Click on *Apply Changes* to finish the dialog and return to the *Home Edit* page.

## Task 3: Exploring the Social Media Responder Generative AI Implementation

1. Click on the *Run Application* option to log into the application. Use **hol23** for the login and **Future1sNow#** for the password.

    ![Run application](images/run-application.png)

2. Within your application session, select the *Social Media Responder* option from the left-hand menu to open the page.

    ![SMR Initial Page](images/SMR-initial-page.png)

    If you want to limit the number of rows retrieved at one time by the report in the top region, you can reduce it by selecting the Actions drop-down list and select a lower number of rows as shown below. 

    ![Set rows displayed lower ](images/SMR-set-rows-displayed.png)

3. Let's explore this page a bit more. 

    - It uses an APEX *interactive report* to retrieve social media responses which were deemed *negative* relative to the original message posted.
    - It will to generate a response with a particular **sentiment** (*angry, neutral,* or *friendly*).
    - It will also generate the response in a ready-to-paste format as either an **email** (including the selected entity's *email address*) or an **SMS text** (including the selected entity's *social media handle*). 

    ![SMR Choose Response](images/SMR-choose-response-for-evaluation.png)

4. Here's an example of how the page works in real life. Based on relative source vs. target polarity ratings, we've chosen a particularly vehement reponse to a prior positive message, selected the desired sentiment and format, and then clicked on the *Ask AI For Help* button:

    ![SMR Example Execution](images/SMR-example-execution.png)

5. Let's see how the underlying code generates the prompt before submitting it to the OCI Generative AI service we've configured. Return to the APEX Edit Home page and then select the page named *500 - Social Media Responder* to edit it:

    ![Page-500-00](images/SMR-edit-page-500.png)

    From the left-hand-side menu that's displayed, drill down into the page's attributes, select the *Formulate* button, and then expand the list of its dynamic actions:

    ![Page-500-01](images/SMR-edit-dynamic-actions-menu.png)

    - Click on the *Build Prompt* dynamic action and then from the right-hand-side menu, open and expand the underlying *PL/SQL Function Body* that it actually executes:

    ![Page-500-02](images/SMR-expand-PLSQL.png)

    - First, the function translates selected values for *Answer Sentiment* and *Answer Type* radio button groups into prompt directives.
    
    - Next, it captures either the appropriate *email address* or *social media handle* of the sender to which we'd be responding. Then, it constructs the prompt that will be sent to our specified generative AI service.

    - Note the call to the **pkg\_rag\_processing.summary\_document** PL/SQL package procedure. The code for that package is available in the scripts you downloaded (see **pkg-rag-processing.sql**). That procedure invokes logic to retrieve the top four approximate matches to the selected message text and returns those matching document chunks in paragraph format. 
    
    ![Page-500-03](images/SMR-buildprompt-code.png)

    - Finally, the code that the *RenderAnswer* process executes submits the engineered prompt to the OCI Generative AI service we've configured using the **APEX\_AI.GENERATE** procedure. OCI Generative AI then uses the specified generative AI model - in our case, **meta-llama-3.3-70b-instruct** - to perform some additional refinement of the response before it's returned for human review.

    ![Page-500-04](images/SMR-renderanswer-code.png)

6. Feel free to explore the myriad messages presented here, choose a sentiment and format, and generate a response to the message to see how the generative AI aspects of the application work.

**You have now completed this Live Lab.** You may sign out of your Oracle 23ai ADB Always Free environment.

## Learn More
* [Using the APEX Graph Visualization Plug-In](https://docs.oracle.com/en/database/oracle/property-graph/23.3/spgdg/visualizing-sql-graph-queries-using-apex-graph-visualization-plug.html)
* [APEX and Property Graphs in Oracle Database 23c (video)](https://www.youtube.com/watch?v=DODoJI3sR14)
* [Powering Network Topology Planning and Administration with Oracle Graph](https://blogs.oracle.com/database/post/powering-network-topology-planning-and-administration-with-oracle-graph)
* [Pretrained Foundational Models in Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm)
* [Chat in OCI Generative AI](https://docs.oracle.com/en-us/iaas/Content/generative-ai/use-playground-chat.htm)
* [APEX 24.1 APEX_AI Package](https://docs.oracle.com/en/database/oracle/apex/24.1/aeapi/APEX_AI.html)

## Scholarly Reading
* [Fame for sale: Efficient detection of fake Twitter followers](https://www.sciencedirect.com/science/article/abs/pii/S0167923615001803)
* [Social Media Sentiment Analysis](https://towardsdatascience.com/sentiment-analysis-74624b075842)
* [Detecting Fake Users on Social Media with a Graph Database](https://journals.uvic.ca/index.php/arbutus/article/view/20027)

## Acknowledgements
- **Author** - Jim Czuprynski, LiveLabs Contributor, Zero Defect Computing, Inc. 
* **Last Updated By/Date** - Jim Czuprynski, February 2025