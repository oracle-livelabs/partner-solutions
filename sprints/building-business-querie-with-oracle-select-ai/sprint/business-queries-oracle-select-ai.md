# How to build Business Queries with Oracle Select AI
Estimated Time: 30–45 minutes

## Introduction

Oracle Select AI enables users to turn natural language business questions into SQL queries. While SQL is deterministic, human questions are often ambiguous or multi-step. Select AI generates candidate SQL, which can then be reviewed, refined, and executed to produce actionable insights directly from the database.


## 1. Create Structured Table (Orders)

Create a table to store structured business data for querying with Select AI.

```sql

CREATE TABLE orders (
  order_id NUMBER PRIMARY KEY,
  product VARCHAR2(50),
  category VARCHAR2(50),
  order_amount NUMBER,
  order_date DATE
);

```

> **Key Concept**: Structured tables provide deterministic data for AI-generated SQL to filter, aggregate, and join.


## 2. Insert Sample Data

Populate the orders table with sample data to enable meaningful query results.

```sql

INSERT INTO orders (order_id, product, category, order_amount, order_date)
VALUES (1, 'Laptop', 'Electronics', 1200, DATE '2026-01-01');

```

```sql

INSERT INTO orders (order_id, product, category, order_amount, order_date)
VALUES (2, 'Headphones', 'Electronics', 150, DATE '2026-01-02');

```

```sql

INSERT INTO orders (order_id, product, category, order_amount, order_date)
VALUES (3, 'Office Chair', 'Furniture', 700, DATE '2026-01-03');

```

> **Key Concept**: Populating structured tables provides a foundation for AI-generated SQL to query, filter, and aggregate results.


## Section 3: Formulate Natural Language Queries

Define the business questions that Select AI will translate into SQL.

Examples:

1.	“Which products had orders over $500?”
2.	“Total sales per category for January 2026.”
3.	“List products with the highest order amounts and their order dates.”

> **Key Concept**: Clear prompts help Select AI generate accurate SQL queries.


## Section 4: Generate SQL with Select AI

Convert natural language business questions into executable SQL using Select AI.

Example AI-Generated SQL:

1. Query 1: Products with orders over $500

```sql

SELECT product, order_amount
FROM orders
WHERE order_amount > 500
ORDER BY order_amount DESC;

```

2. Query 2: Total sales per category for January 2026

```sql

SELECT category, SUM(order_amount) AS total_sales
FROM orders
WHERE order_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
GROUP BY category;

```

> **Key Concept**: Select AI uses schema and column names to translate human intent into executable SQL, suggesting joins, filters, and aggregates automatically.


## Section 5: Review and Validate AI-Generated SQL

Inspect and refine AI-generated SQL to ensure it correctly answers the business question.

Example Correction:
If AI missed a filter for a date range:

**Corrected SQL**

```sql

SELECT product, order_amount
FROM orders
WHERE order_amount > 500
AND order_date >= DATE '2026-01-01'
ORDER BY order_amount DESC;

```

> **Key Concept**: Human validation ensures AI-generated SQL aligns with business intent.


## Section 6: Execute Queries

Run the validated SQL queries to retrieve deterministic results.

```sql

SELECT product, order_amount
FROM orders
WHERE order_amount > 500
ORDER BY order_amount DESC;
 
```

> **Key Concept**: Executing validated AI SQL returns deterministic results that answer the original natural language question.


## Section 7: Advanced Queries with Multiple Conditions

Use Select AI to generate queries with multiple conditions and sorting.

Example Prompt:
“Find products with orders over $500 placed in January 2026 and sort by order amount descending.”

```sql

SELECT product, order_amount, order_date
FROM orders
WHERE order_amount > 500
AND order_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
ORDER BY order_amount DESC;

```

> **Key Concept**: Select AI handles multi-step queries that would be tedious to write manually.


## Section 8:  Hybrid Query: Combining Structured Metrics with Vector Search

Retrieve top-selling products along with the most relevant customer feedback using vector search.

Create Feedback Table: 

```sql

CREATE TABLE feedback (
  feedback_id NUMBER PRIMARY KEY,
  feedback_text CLOB NOT NULL,
  feedback_vector VECTOR(1536, FLOAT32)
);

```

Insert Sample Feedback:

```sql

INSERT INTO feedback (feedback_id, feedback_text, feedback_vector)
VALUES (1, 'The laptop delivery was delayed by 3 days.',
VECTOR_EMBEDDING(FLOAT32, 'The laptop delivery was delayed by 3 days.'));

```

```sql

INSERT INTO feedback (feedback_id, feedback_text, feedback_vector)
VALUES (2, 'Headphones packaging was damaged upon arrival.',
VECTOR_EMBEDDING(FLOAT32, 'Headphones packaging was damaged upon arrival.'));

```

Hybrid Query Example:

```sql

SELECT o.product,
       o.order_amount,
       f.feedback_text
FROM orders o
LEFT JOIN feedback f
  ON VECTOR_DISTANCE(
       f.feedback_vector,
       VECTOR_EMBEDDING(FLOAT32, 'delivery issue ' || o.product),
COSINE
     ) < 0.3
ORDER BY o.order_amount DESC
FETCH FIRST 2 ROWS ONLY;

```

> **Key Concept**: Hybrid queries combine deterministic SQL results with AI-powered semantic search to answer complex business questions.

## Section 9: Summary

In this lab, you learned to:

*   Formulate natural language business questions
*   Generate SQL queries using Oracle Select AI
*   Validate and refine AI-generated SQL
*   Execute queries to get deterministic results
*   Integrate vector search for hybrid insights

Oracle Select AI enables AI-assisted SQL query generation, translating human intent into actionable database queries efficiently, while preserving human oversight and ensuring accuracy.


## Learn More

*   [Generate SQL from Natural Language Prompts Using Select AI](https://docs.oracle.com/en/cloud/paas/autonomous-database/dedicated/hsarg/#articletitle)
*   [Use Select AI for Natural Language Interaction with your Database](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/select-ai.html)
*   [Announcing Select AI with Retrieval Augmented Generation (RAG) on Autonomous Database](https://blogs.oracle.com/machinelearning/announcing-select-ai-with-rag-on-adb)


## Acknowledgements

* **Author** - Nagatanmayee Gunukula
* **Last Updated By/Date** - Nagatanmayee Gunukula, February 2026
