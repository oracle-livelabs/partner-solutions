# How to build a Help Desk FAQ with Oracle AI Vector Search
Estimated Time: 30 minutes

## Introduction

As organizations adopt AI-driven applications, the ability to search and retrieve information based on meaning rather than exact keywords has become essential. Oracle AI Database 26ai introduces AI-native Vector Search, enabling developers to store, index, and compare vector embeddings directly within the database using standard SQL. This workshop provides a practical introduction to these capabilities by demonstrating how semantic search can be implemented efficiently and securely without relying on external AI services or complex pipelines.


## Section 1: Create the Table

We first create a table to store help desk requests. The table has columns for id, title, help\_text, and help_vector. The help\_vector column will store the embedding of the help\_text for semantic search.

```sql

CREATE TABLE help_desk(
  id NUMBER PRIMARY KEY,
  title VARCHAR(32),
  help_text CLOB NOT NULL,
  help_vector VECTOR(1536, FLOAT32)
);

```

> **Key Concept**: Embeddings are stored directly in the database, allowing AI-native search with SQL.


## Section 2: Insert Data with Embeddings

Insert sample help desk entries. Each help\_text is converted into a vector embedding at insert time using **VECTOR\_EMBEDDING**. These embeddings allow similarity search later.

```sql

INSERT INTO help_desk (id, title, help_text, help_vector)
VALUES (
  1,
  'Medical Assistance',
  'I need help finding a doctor for headache pain',
  VECTOR_EMBEDDING(FLOAT32, 'I need help finding a doctor for headache pain')
);

```

```sql

INSERT INTO help_desk (id, title, help_text, help_vector)
VALUES (
  2,
  'Professional Support',
  'Need assistance from a medical professional for stomach pain',
  VECTOR_EMBEDDING(FLOAT32, 'Need assistance from a medical professional for stomach pain')
);

```

```sql

INSERT INTO help_desk (id, title, help_text, help_vector)
VALUES (
  3,
  'Billing Issue',
  'I have a billing related question',
  VECTOR_EMBEDDING(FLOAT32, 'I have a billing related question')
);

```

> **Note**: Each row has a unique ID and embedding is derived directly from help_text.


## Section 3: Create a Vector Index

To improve search performance, we create a vector index on the help_vector column using the COSINE distance metric.

```sql

CREATE VECTOR INDEX help_desk_vec_idx
ON help_desk(help_vector)
WITH (DISTANCE = COSINE);

```

> **Key Concept**: Vector indexes make similarity queries efficient, especially on large datasets.


## Section 4: Query for Similar Help Requests

Perform a semantic search by embedding a user query and comparing it to the stored help vectors using VECTOR_DISTANCE. Results are ordered by similarity and limited to the top 2 matches.

```sql

SELECT title, help_text
FROM help_desk
ORDER BY VECTOR_DISTANCE(
  help_vector,
  VECTOR_EMBEDDING(FLOAT32, 'I need help finding a doctor for headache pain'),
  COSINE
)
FETCH FIRST 2 ROWS ONLY;

```

> **Key Concept**: The database calculates similarity directly in SQL using embeddings. No external AI tools are needed.


## Section 5: Summary

 In this lab, you learned to:

*   Create a table with AI-native vector embeddings
*   Insert text data and generate embeddings at insert time
*   Build a vector index for efficient semantic search
*   Query the table for semantically similar help requests using SQL

This demonstrates how Oracle AI Database 26ai allows AI-powered search natively inside SQL, simplifying pipelines and improving performance.


## Learn More

* [Oracle AI Vector Search](https://www.oracle.com/database/ai-vector-search/)
* [AI Vector Search Key Features](https://www.oracle.com/database/ai-vector-search/features/)
* [Oracle AI Vector Search User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/index.html)


## Acknowledgements

* **Author** - Nagatanmayee Gunukula
* **Last Updated By/Date** - Nagatanmayee Gunukula, February 2026
