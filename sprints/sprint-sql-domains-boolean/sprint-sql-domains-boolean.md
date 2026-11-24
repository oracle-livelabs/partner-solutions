# How do I enforce a data rule once and reuse it on every column with SQL Domains in Oracle Database 26ai?

## Introduction

Schemas often repeat the same rules in multiple tables: email columns use the same validation, quantities must stay within the same range, and flags use separate conventions. When a rule changes, every copy must be updated.

Oracle Database 26ai SQL Domains let you define a data type, constraints, display format, and annotations once, then reuse them on columns. Oracle Database 26ai also supports a native`BOOLEAN` data type.

## Objectives

After this sprint, you will be able to:

- Define reusable SQL Domains with constraints, display formats, and annotations.
- Apply domains to table columns and use BOOLEAN values in SQL predicates.
- Display domain-formatted values and find domain usage in the data dictionary.

**Estimated Time:** 10 minutes

### Before you begin

Use an Oracle Database 26ai environment, such as FreeSQL / Live SQL, SQL Workshop on apex.oracle.com, an Always Free Autonomous Database, or Oracle Database 26ai Free.

### 1. Create the domains

Create a domain for email addresses and another for food weights in kilograms:

```sql
CREATE DOMAIN IF NOT EXISTS email_d AS VARCHAR2(320)
  CONSTRAINT email_chk
  CHECK (REGEXP_LIKE(email_d, '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
  DISPLAY LOWER(email_d)
  ANNOTATIONS (Description 'A basic email address pattern');

CREATE DOMAIN IF NOT EXISTS qty_kg_d AS NUMBER(7,2)
  CONSTRAINT qty_kg_chk
  CHECK (qty_kg_d > 0 AND qty_kg_d <= 2000)
  DISPLAY TO_CHAR(qty_kg_d, 'FM99990.0') || ' kg';
```

Inside a domain, the domain name represents the value stored in a column that uses the domain. For example, `email_d` in the constraint refers to the email value.

### 2. Use the domains and BOOLEAN in a table

You can use a domain as the column data type or attach it to a compatible type with the `DOMAIN` keyword.

```sql
CREATE TABLE IF NOT EXISTS food_donations (
  donation_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  donor_email email_d NOT NULL,
  quantity_kg NUMBER(7,2) DOMAIN qty_kg_d,
  is_vegetarian BOOLEAN DEFAULT FALSE NOT NULL,
  donated_on DATE DEFAULT SYSDATE
);
```

Both `donor_email email_d` and `quantity_kg NUMBER(7,2) DOMAIN qty_kg_d` apply the same domain rules.

### 3. Insert valid data and test the constraints

Insert valid rows:

```sql
INSERT INTO food_donations (donor_email, quantity_kg, is_vegetarian)
VALUES
  ('Chef@SpiceRoute.example', 14.5, TRUE),
  ('hello@greenleaf.example', 8, FALSE),
  ('orders@sunrise.example', 22, TRUE);
```

Try values that violate the domains:

```sql
INSERT INTO food_donations (donor_email, quantity_kg)
VALUES ('not-an-email', 5);
-- Error: EMAIL_CHK is violated

INSERT INTO food_donations (donor_email, quantity_kg)
VALUES ('a@b.example', -3);
-- Error: QTY_KG_CHK is violated
```

You did not define `CHECK` constraints on the table, but the database enforces both domain rules.

### 4. Query BOOLEAN values and display domain formats

Use `DOMAIN_DISPLAY` to apply each domain's display expression in a query. A BOOLEAN column can be used as a predicate.

```sql
SELECT donation_id,
       DOMAIN_DISPLAY(donor_email) AS email,
       DOMAIN_DISPLAY(quantity_kg) AS quantity,
       is_vegetarian
FROM food_donations
WHERE is_vegetarian;
```

The email is displayed in lowercase, and the quantity is displayed with the `kg` suffix.

BOOLEAN columns accept `TRUE` and `FALSE`. Oracle Database also supports values such as `'yes'` / `'no'`, `'on'` / `'off'`, `1` / `0`, and `'t'` / `'f'`. You can use BOOLEAN values in `WHERE`, `CASE WHEN`, and PL/SQL expressions.

Count non-vegetarian donations:

```sql
SELECT COUNT(*) AS non_veg_count
FROM food_donations
WHERE NOT is_vegetarian;
```

### 5. Find where a domain is used

Query the data dictionary to list columns that use domains:

```sql
SELECT table_name, column_name, domain_name
FROM user_tab_columns
WHERE domain_name IS NOT NULL;
```

Find annotations associated with the email domain:

```sql
SELECT *
FROM user_annotations_usage
WHERE object_name = 'EMAIL_D';
```

Because a domain centralizes its rule, these queries help you identify where that rule applies.

### 6. Clean up

Drop the table first, then drop its domains:

```sql
DROP TABLE IF EXISTS food_donations PURGE;
DROP DOMAIN IF EXISTS email_d;
DROP DOMAIN IF EXISTS qty_kg_d;
```

### 7. Summary

In this sprint, you learned how to:

- Define reusable SQL Domains with constraints, display formats, and annotations.
- Apply a domain's display format with `DOMAIN_DISPLAY`.
- Use `BOOLEAN` as a native SQL type and in predicates.
- Use `IF [NOT] EXISTS` to make supported DDL scripts safe to rerun.

## Learn More

- [CREATE DOMAIN — Oracle AI Database SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-domain.html)
- [DOMAIN_DISPLAY — Oracle AI Database SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/domain_display.html)
- [Boolean Data Type — Oracle AI Database SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/Data-Types.html)

See these features in the FoodRescue Network APEX project, which uses `fr_email_d`, `fr_qty_kg_d`, and `fr_listing_status_d`.

## Acknowledgements

- **Author** — Nagatanmayee Gunukula
- **Last Updated By/Date** — November 2026
