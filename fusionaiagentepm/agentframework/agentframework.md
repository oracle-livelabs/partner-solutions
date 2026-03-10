# Create Topics, Agents and Agent Teams for the EPM Agent

## Introduction

Now that the key building block (Tool) is completed, we will move on to creating context for the Agent. If Tools purpose is to make the connection with input parameters, Topics purpose in AI Agent Studio is to provide context for the parameters provided and the subsequent prompts provided to the Agent. In this lab, we will build a Topic specific to this EPM Agent followed by defining the Agent and Agent Teams for the agent.

Estimated Time: 20 minutes

### About creating Topics, Agents and Agent Teams
Once the Tools are created in Agent Studio, Topics, Agents and Agent Teams provide a mechanism to create context, build prompt engineering, select appropriate Large Language Models (LLM), create starter questions and manage answers and responses.
For more information on these building blocks in Agent Studio, please refer to the following - [AI Agent Studio documentation](https://docs.oracle.com/en/cloud/saas/fusion-ai/aiaas/components-of-ai-agent-studio.html)

### Objectives

In this lab, you will:
* Create the EPM agent specific Topic
* Create the Agent using the created Tool and Topic
* Build the Agent Team

### Prerequisites (Optional)

This lab assumes you have:
* An Oracle Fusion AI Agent license & account
* A foundational understanding of AI Agent Studio components

## Task 1: Build the EPM Topic

1. Click on **Topics** and click **Add**.

    ![Select Topics](images/selecttopics.png)

    ![Add Topic](images/addtopic.png)
  
2. Create the **Topic Name**, **Topic Code**, **Family**, **Product** and **Description**   as shown in the picture.

    ![Topic Detail1](images/topicdetail1.png)

3. **Instructions** is a key part of any Agent, much like it is when you are creating a Custom GPT. Be specific in providing context. For example, you will see that the instruction written for this Agent has detail for **Required Information**, **Conversation Flow**, **Examples** and **Constraints**. 

    ![Topic Detail2](images/topicdetail2.png)

    ![Topic Detail3](images/topicdetail3.png)

    *Note - it is important to provide the details in Instructions as the instruction will provide the context framing and prompt management for the Agent.*

4. Hit the **Save** button once Instructions are done. You have created the EPM Topic.

## Task 2: Build the Agent

1. Click **Agents** and then click **Add**.

    ![Select Agents](images/selectagents.png)

    ![Add Agent](images/addagent.png)

2. Input the **Details** as shown or make it specific to your use case.

    ![Agent Details](images/agentdetails.png)

  	*Note - **Details** can be specific to your use case. **LLM** selection will depend upon which ones your subscription has access to.*

3. Add the **Tools** component by searching for **EPM** in the search box.

    ![Add Tool to Agent](images/addtooltoagent.png)

4. Add the **Topics** component by searching for **EPM** in the search box.

    ![Add Topic to Agent](images/addtopictoagent.png)

## Task 3: Build Agent Team

1. Click **Agent Teams** and then click **Add**.

    ![Select Agent Teams](images/selectagentteams.png)

    ![Add Agent Team](images/addagentteam.png)

2. Input Details as shown, or make it specific to your needs. 

    ![Agent Team Details](images/agentteamdetails.png)

  	*Note - pay particular attention to the **Type** of Agent Team i.e. **Supervisor**. Additional details such as **LLM**, **Security**, **Chat Experience**, **Questions** and **Input Variables** are going to be specific to the kind of agent that is being deployed and to your organization's needs.*

You have your first EPM Agent built in AI Agent Studio. In the next lab, we will spend time in asking questions of the Agent built. 

Take the following quiz to gauge what you have learned so far.

```quiz
Q: What is the purpose of a Topic in AI Agent Studio?
- Create context
- Provide constraints
- Provide prompt detail
* All of the above

Q: What building components can you pull into an Agent?
* Tools, Topics and External Tools
- Tools and Topics
- Tools only
- Topics only

```

## Learn More

*Useful resource links:*

* [How to use and build in AI Agent Studio](https://docs.oracle.com/en/cloud/saas/fusion-ai/aiaas/overview.html)
* [Components of Agent Studio](https://docs.oracle.com/en/cloud/saas/fusion-ai/aiaas/components-of-ai-agent-studio.html)


## Acknowledgements
* **Author** - Vatsal Gaonkar, Director, Digital Core Modernization, PwC
* **Last Updated By/Date** - Vatsal Gaonkar, March 2026
