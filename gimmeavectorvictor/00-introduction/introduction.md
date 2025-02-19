# Introduction

## About this Workshop

![Logo](images/ZDCLogo.png)

### Community-Contributed Workshop

* **Author:** Jim Czuprynski, Oracle ACE Director, Zero Defect Computing, Inc.

This LiveLab session focuses on a real-world business problem: Deploying a generative AI solution to help an overwhelmed social media campaign manager deal with a new product launch announcement that's failing because trolls have taken over the narrative. To seize the initiative, we will assemble a corpus of relevant documents, then "chunk" and create embeddings for their content using a tested Open Neural Network Exchange (ONNX) LLM and store them within an Oracle 23ai database table with a VECTOR datatype. Then we'll build an APEX application to apply OpenAI LLMs to produce either email or SMS responses to comments to enable the campaign manager to review and approve them before posting to our social media network.

To gain the most from these labs, you should be familiar with basic Oracle Database and APEX concepts. An understanding of the underlying principles of Large Language Models (LLMs), vector databases, and the mathematics that underlie these concepts will insure quicker uptake of topics.

### Objectives
In this lab, you will learn how to:
- Implement the new 23ai **VECTOR** datatype for use by LLMs and Generative AI applications
- Translate a specific set of documents into a useful corpus, including embeddings, with **DBMS_VECTOR** and **DBMS_VECTOR_CHAIN**
- Use **VECTOR_DISTANCE** to perform exact and similarity searches against an indexed VECTOR datatype
- Build a sample APEX application with **APEX_AI** and external LLM APIs to interact with users

### Labs

| # | Lab | Est. Time |
| --- | --- | --- |
| 1 | [Provision an Oracle Autonomous Database](?lab=initialize-livelabs-environment) | 10 min |
| 2 | [Prepare Development Environment](?lab=prepare-development-environment) | 10 min |
| 3 | [Populate Database Schema](?lab=populate-database-schema) | 10 min |
| 4 | [Import ONNX Trained LLMs](?lab=import-genai-llms) | 5 min |
| 5 | [Build Document Corpus](?lab=build-llm-corpus) | 5 min |
| 6 | [Create Corpus Embeddings](?lab=create-corpus-embeddings) | 10 min |
| 7 | [Create Vector Indexes](?lab=create-vector-indexes) | 10 min |
| 8 | [Create ChatBot Application](?lab=enable-chatbot-application) | 10 min |
| 9 | [Interact With Chatbot Application](?lab=interact-with-chatbot) | 10 min |
{: title="Labs with Times"}

Estimated Time: 80 minutes

### **Let's Get Started!**

- [Click here](?lab=initialize-livelabs-environment), select **Lab 1** from the menu on the left, or click the arrow below to start the workshop.

## Learn More

- [Oracle Generative AI Services](https://www.oracle.com/artificial-intelligence/generative-ai/generative-ai-service/)
- [Oracle Autonomous Database](https://www.oracle.com/autonomous-database/)
- [Oracle APEX](https://apex.oracle.com/en/)
- [APEX Community](https://apex.oracle.com/community)

## Acknowledgements

* **Author** - Jim Czuprynski, LiveLabs Contributor, Zero Defect Computing, Inc.
* **Contributors** - Hope Fisher, Program Manager, Database Product Management
* **Last Updated By/Date** - Jim Czuprynski - February 2025