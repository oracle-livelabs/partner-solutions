

## [ FINISH: 
     WHAT TO EXPLORE NEXT? 
     SHOULD WE EXCLUDE CHUNKING METHOD ALTERNATIVES?
     OR MOVE THAT TO A SEPARATE SECTION FOR EXTRA CREDIT?
   ]

## Task 2: Explore Impact of Different Chunking Methods

1. From your SQL Web Developer session, open the  ... 
 **create-corpus_tables.sql** 
 script. This script will 
 create two new tables, **CORPUS_DOCUMENTS** and **CORPUS_EMBEDDINGS**. 
 Click the *Run Script* button or hit *F5* to execute the script.


   ![Do something](./images/do-something.png)

1. Next, open and execute the 
**load-onnx-models.sql** 
script. 
This script will ... 

   ![Do something](./images/do-something.png)


## Task 3: Create PL/SQL Package for Creating Generative AI Responses

1. From your SQL Web Developer session, open the **pkg-rag-processing.sql** script and then click the *Run Script* button or hit *F5* to execute the script. 

   ![Create PKG_RAG_PROCESSING](./images/create-pkg-rag-processing.png)


   This script creates a new database package we'll use within our APEX application. This package's procedures gather the most appropriate corpus chunks from the **CORPUS_CHUNKS** table that best answer a specific respondent's comment - a crucial part of the task we'll submit to a generative AI model. 

   Let's take a closer look at the **SummaryDocument** procedure in this package:

   - It accepts the text of the user question as a CLOB. 
   - It then selects the four best corpus chunks that best answer the comment by performing an approximate search using a cosine method against our document corpus.
   - It combines the original user question, the corpus chunks, and other input as a CLOB and passes it to the **DBMS_VECTOR_CHAIN.UTL_TO_SUMMARY** function.
   - That function uses generative AI to construct and return a *document summary* as a CLOB that incorporates all these inputs.

   

[ FINISH ] Nitin's L/I post: https://www.linkedin.com/posts/nitin-vengurlekar-55349447_aiml-vectorsearch-aianalytics-activity-7290472346149175297-aE4m?utm_source=share&utm_medium=member_desktop

