# Introduction

## About this workshop

**Community Contributed Workshop**

![Qubix Logo](./images/qubix-logo.png =300x300)
* **Authors:** *Žiga Vaupot, Oracle ACE Pro - Business Intelligence, Qubix*
* **Contributor & Reviewer:** *Grega Dvoršak, ML/AI Consultant, Qubix*

Oracle Cloud Infrastructure (OCI) is **just like a box of chocolates**. It is offering a variety of cloud services, including serverless and very user friendly AI services such as  Vision or Language. In this workshop you will learn how **train the model for image classification using OCI Vision** and **how to use that model in Oracle Analytics in order to classify new X-Ray images**.

The use case for this workshop is **x-ray image classification for pneumonia**.

You will begin this workshop by performing some of the prerequisite steps which are (not all) required to perform the workshop. These prerequisite steps need to be done by your tenancy administrator. When prerequisites are completed, you will setup an image library in Object Storage. Then you will load all X-ray images for model training into your image library. Setting image library and putting X-ray images into respective folders is not enough for OCI Vision to start training models. That is why, you will have to label all your images, using data labeling utility, giving them one of the two labels: pneumonia or normal. Once all images in a training dataset are labeled, you will create and deploy an image classification model using OCI Vision. To conclude this workshop, you will register OCI Vision machine learning model with Oracle Analytics and use it for new images classification.

Estimated workshop time: 4-8 hours (depending on training duration selection)

[Just like a box of chocolates @ Youtube](youtube:vIn7ujfadx4)

### Objectives

In this workshop, you will learn how to:

* Setup an image library in Object Storage.
* Create a dataset and label images from image library using Data Labeling service.
* Train a custom model using OCI Vision for image classification.
* Register and deploy OCI Vision based machine learning model in Oracle Analytics.

### Prerequisites

This lab assumes you have:

* Basic understanding of Oracle Cloud Infrastructure management, such as creating user and groups, creating policies, creating OCI services.
* An Oracle Cloud account.
* Privileges to create and use OCI services: OCI Object Storage, Data Labeling, Vision and Analytics.
* Really basic understanding of Python programming.
* Kaggle.com account. If you haven't got one, you can set it very easy. And is free.

### Internet browser requirement

This lab assumes that you are using Google Chrome. 

In one of the labs, you will be required to download images directly into OCI Cloud Shell. This requires cookie information copied to OCI Cloud to log into Kaggle.com directly. If you are not using Google Chrome, please make sure you make changes to your browser setting accordingly. As a reference, these instructions[https://wdeback.gitlab.io/post/2018-03-08-how-to-download-kaggle-dataset-from-command-line/] have been used in the workshop. More detailed steps are described in later labs of this workshop.

### Data

The workshop is using the following dataset:

* Original dataset: **Labeled Optical Coherence Tomography (OCT) and Chest X-Ray Images for Classification**
    Dataset of validated OCT and Chest X-Ray images  described and analyzed in "Deep learning-based classification and referral of treatable human diseases". The OCT Images are split into a training set and a testing set of independent patients. OCT Images are labeled as (disease)-(randomized patient ID)-(image number by this patient) and split into 4 directories: CNV, DME, DRUSEN, and NORMAL.
    Kermany, Daniel; Zhang, Kang; Goldbaum, Michael (2018), “Labeled Optical Coherence Tomography (OCT) and Chest X-Ray Images for Classification”, Mendeley Data, V2, doi: 10.17632/rscbjbr9sj.2 [https://data.mendeley.com/datasets/rscbjbr9sj/2](https://data.mendeley.com/datasets/rscbjbr9sj/2)

* Images used for this workshop are using **Chest X-Ray Images (Pneumonia)** dataset, which is a slightly adjusted from the original dataset:
    The dataset is organized into 3 folders (train, test, val) and contains sub-folders for each image category (Pneumonia/Normal). There are 5000+ X-Ray images (JPEG) and 2 categories (Pneumonia/Normal).

    Chest X-ray images (anterior-posterior) were selected from retrospective cohorts of pediatric patients of one to five years old from Guangzhou Women and Children’s Medical Center, Guangzhou. All chest X-ray imaging was performed as part of patients’ routine clinical care.

    For the analysis of chest x-ray images, all chest radiographs were initially screened for quality control by removing all low quality or unreadable scans. The diagnoses for the images were then graded by two expert physicians before being cleared for training the AI system. In order to account for any grading errors, the evaluation set was also checked by a third expert [https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia).

## Learn More

Oracle Documentation

* [OCI Vision](https://docs.oracle.com/en-us/iaas/vision/vision/using/home.htm)
* [OCI Data Labeling](https://docs.oracle.com/en-us/iaas/data-labeling/data-labeling/using/home.htm)
* [OCI Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/home.htm)
* [Oracle Analytics Cloud](https://docs.oracle.com/en-us/iaas/analytics-cloud/index.html)

Žiga Vaupot's Blog

* [Using AI Vision model for Image Classification in Oracle Analytics](https://zigavaupot.blogspot.com/2022/09/using-ai-vision-model-for-image.html)
* [Oracle AI Vision: Just like a Box of Chocolates](https://zigavaupot.blogspot.com/2022/08/oracle-ai-vision-just-like-box-of.html)
* [AI Vision Service in Oracle Data Lakehouse](https://zigavaupot.blogspot.com/2022/05/vision-ai-service-at-oracle-data.html)

## Acknowledgements
* **Author** - Žiga Vaupot, Oracle ACE Pro, Qubix
* **Contributors** -  Grega Dvoršak, Qubix
* **Last Updated By/Date** - Žiga Vaupot, January 2023