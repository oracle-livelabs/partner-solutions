# How do I unlock context-aware AI with database annotations in Oracle Database 26ai?

## Introduction

Traditional `COMMENT ON TABLE` and `COMMENT ON COLUMN` statements store free-form text. That text can be difficult for applications and automated tools to interpret consistently.

**Oracle Database 26ai** supports database annotations: named metadata, with optional values, attached to schema objects and columns. Applications can query this metadata to help render user interfaces, apply business logic, and provide context to AI tools.

### Objectives

After this sprint, you will be able to:

- Create a table with object-level and column-level annotations.
- Query annotation metadata with `USER_ANNOTATIONS_USAGE`.
- Add, modify, and remove annotations with `ALTER TABLE`.
- Add semantic context to a view for AI and data-governance use cases.

Estimated Time: **15 minutes**

### Before you begin

Connect to an Oracle Database 26ai instance using your preferred SQL worksheet.

## Create a table with annotations

Verify your database connection:

```sql
SELECT user,
       SYS_CONTEXT('USERENV', 'DB_NAME') AS db_name
FROM dual;
```

Create a `products` table with annotations on the table and its columns:

```sql
CREATE TABLE products (
  product_id NUMBER
    ANNOTATIONS (
      SurrogateKey,
      UI_Display 'Product ID',
      Classification 'Core Inventory'
    ),
  product_name VARCHAR2(100)
    ANNOTATIONS (
      UI_Display 'Item Name',
      Classification 'Descriptive Metadata'
    ),
  unit_price NUMBER(10,2)
    ANNOTATIONS (
      UI_Display 'Unit Price ($)',
      Classification 'Financial Metrics'
    ),
  stock_qty NUMBER
    ANNOTATIONS (
      UI_Display 'Available Quantity',
      Classification 'Inventory Levels'
    )
)
ANNOTATIONS (
  UI_Display 'Product Master Catalog',
  BusinessOwner 'Supply Chain Team'
);
```

The annotations describe the table and its columns. For example, `product_id` is marked as a surrogate key and given a display label.

### 2. Query annotation metadata

Use `USER_ANNOTATIONS_USAGE` to inspect annotation names, values, and the objects that use them:

```sql
SET LINESIZE 150
COLUMN object_name FORMAT A15
COLUMN column_name FORMAT A15
COLUMN annotation_name FORMAT A20
COLUMN annotation_value FORMAT A25

SELECT object_name,
       column_name,
       annotation_name,
       annotation_value
FROM user_annotations_usage
WHERE object_name = 'PRODUCTS';
```

The output lists annotations for the table and its columns, including values such as `UI_Display = 'Product ID'`.

### 3. Modify annotations

Add security and compliance annotations to the table:

```sql
ALTER TABLE products
  ANNOTATIONS (
    SecurityTier 'Confidential-Internal',
    ComplianceCheck 'Passed'
  );
```

Update the `unit_price` column by dropping its `Classification` annotation and adding a visibility status:

```sql
ALTER TABLE products MODIFY (
  unit_price ANNOTATIONS (
    DROP Classification,
    ADD VisibilityStatus 'Restricted-Access'
  )
);
```

Run the metadata query again to review the changes:

```sql
SELECT object_name,
       column_name,
       annotation_name,
       annotation_value
FROM user_annotations_usage
WHERE object_name = 'PRODUCTS';
```

### 4. Use annotations to provide context for AI

Semantic context can help explain a view when it is exposed to generative AI or automated agents. Add an `AI_Context` annotation to a reporting view:

```sql
CREATE OR REPLACE VIEW v_inventory_summary
  ANNOTATIONS (
    AI_Context 'Provides aggregated stock levels and financial exposure'
  )
AS
SELECT product_name,
       stock_qty,
       unit_price,
       stock_qty * unit_price AS total_valuation
FROM products;
```

### 5. Apply annotation-management practices

Use consistent, concise annotation keys such as `UI_Display`, `SurrogateKey`, and `AI_Context` so applications can interpret them reliably.

Audit annotation usage by querying `USER_ANNOTATIONS_USAGE` for the current schema or `DBA_ANNOTATIONS_USAGE` across database workloads, when you have the required access.

## Summary

In this sprint, you learned how to:

- Add structured annotations to tables, columns, and views.
- Read annotation names and values from a data dictionary view.
- Evolve annotations with `ALTER TABLE`.
- Add semantic context to schema objects for application and AI use cases.

## Learn More

- [ANNOTATIONS Clause — Oracle AI Database SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/annotations_clause.html)
- [Schema Annotations — Oracle AI Database Development Guide](https://docs.oracle.com/en/database/oracle/oracle-database/26/adfns/registering-application-data-usage-database.html)
- [Generate and Improve SQL Queries with Select AI](https://docs.oracle.com/en/database/oracle/oracle-database/26/selai/generate-and-improve-sql-queries.html)

## Acknowledgements

- **Author** — Satishbabu Gunukula
- **Last Updated By/Date** — November 2026
