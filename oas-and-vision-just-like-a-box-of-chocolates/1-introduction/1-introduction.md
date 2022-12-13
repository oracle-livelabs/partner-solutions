# Introduction

## About this Workshop

In this workshop you will learn how train the model for image classification using Vision AI service and how to use that model in Oracle Analytics in order to clasify new X-Ray images for pneumonia. 

This exercise begins with setting up an image library of X-Ray images representing pneumonia infected and normal lungs. Images are not ready as all images needs to be labeled to start vision ML model training. Once all images in training dataset are labeled, model is created and deployed. To conclude this workshop, Vision ML model is registered with Oracle Analytics and used in new images classification for pneumonia.

Estimated Workshop Time: 4 hours (depending on the model training duration selected)

[Just like a box of chocolated @ Youtube](youtube:vIn7ujfadx4)

### Objectives

In this workshop, you will learn how to:
* Setup image image library in Object Storage
* Create a dataset in Data Labeling service and label images for Pneumonia
* Train a custom Vision ML model for X-Ray image classification
* Register and deploy Vision ML model in Oracle Analytics

### Prerequisites

This lab assumes you have:
* An Oracle Free tier or Paid Cloud account
* Privileges to create and use OCI services: OCI Object Storage, Data Labeling, Data Science, Vision, Analytics
* Familiar with basic OCI management
* Familiar with OCI policies
* Familiar with Python programming is optional

### Data

The workshop is using the following dataset:

* Original dataset: **Labeled Optical Coherence Tomography (OCT) and Chest X-Ray Images for Classification**
    Dataset of validated OCT and Chest X-Ray images  described and analyzed in "Deep learning-based classification and referral of treatable human diseases". The OCT Images are split into a training set and a testing set of independent patients. OCT Images are labeled as (disease)-(randomized patient ID)-(image number by this patient) and split into 4 directories: CNV, DME, DRUSEN, and NORMAL.
    Kermany, Daniel; Zhang, Kang; Goldbaum, Michael (2018), “Labeled Optical Coherence Tomography (OCT) and Chest X-Ray Images for Classification”, Mendeley Data, V2, doi: 10.17632/rscbjbr9sj.2 [https://data.mendeley.com/datasets/rscbjbr9sj/2](https://data.mendeley.com/datasets/rscbjbr9sj/2)

* Images used for this workshop are using **Chest X-Ray Images (Pneumonia)** dataset, which is a slightly different from the original dataset:
    The dataset is organized into 3 folders (train, test, val) and contains sub-folders for each image category (Pneumonia/Normal). There are 5,863 X-Ray images (JPEG) and 2 categories (Pneumonia/Normal).

    Chest X-ray images (anterior-posterior) were selected from retrospective cohorts of pediatric patients of one to five years old from Guangzhou Women and Children’s Medical Center, Guangzhou. All chest X-ray imaging was performed as part of patients’ routine clinical care.

    For the analysis of chest x-ray images, all chest radiographs were initially screened for quality control by removing all low quality or unreadable scans. The diagnoses for the images were then graded by two expert physicians before being cleared for training the AI system. In order to account for any grading errors, the evaluation set was also checked by a third expert [https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia](https://www.kaggle.com/datasets/paultimothymooney/chest-xray-pneumonia).

## Learn More

Oracle Documentation
* [OCI Vision](https://docs.oracle.com/en-us/iaas/vision/vision/using/home.htm)
* [OCI Data Labeling](https://docs.oracle.com/en-us/iaas/data-labeling/data-labeling/using/home.htm)
* [OCI Data Science](https://docs.oracle.com/en-us/iaas/data-labeling/data-labeling/using/home.htm)
* [OCI Object Storage](https://docs.oracle.com/en-us/iaas/Content/Object/home.htm)
* [Oracle Analytics Cloud](https://docs.oracle.com/en-us/iaas/analytics-cloud/index.html)

Ziga Vaupot's Blog

* [Using AI Vision model for Image Classification in Oracle Analytics](https://zigavaupot.blogspot.com/2022/09/using-ai-vision-model-for-image.html)
* [Oracle AI Vision: Just like a Box of Chocolates](https://zigavaupot.blogspot.com/2022/08/oracle-ai-vision-just-like-box-of.html)
* [AI Vision Service in Oracle Data Lakehouse](https://zigavaupot.blogspot.com/2022/05/vision-ai-service-at-oracle-data.html)

## Acknowledgements
* **Author** - Žiga Vaupot [image](images/SpadeACEPro.png "Oracle ACE Pro"), Qubix Intl.
* **Contributors** -  Grega Dvoršak, Qubix Intl.
* **Last Updated By/Date** - Žiga Vaupot, November 2022