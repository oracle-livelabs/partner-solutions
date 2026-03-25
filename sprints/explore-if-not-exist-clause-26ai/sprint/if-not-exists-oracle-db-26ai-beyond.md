# Explore “IF NOT EXISTS” Clause in Oracle Database 26ai and Beyond

Estimated Time: 15 minutes

## Introduction

In this Sprint, we explore the new IF [NOT] EXISTS DDL clauses in Oracle Database 26ai and beyond. Before Oracle 26ai, the deployment scripts and schema upgrades often fail due to existing objects or attempts to drop non-existent ones, forcing developers to write complex PL/SQL wrappers to handle exceptions. The IF [NOT] EXISTS feature is a game-changer for writing deployment and schema upgrade scripts by making DDL statements repeatable and error-tolerant. It also helps improve CI/CD pipeline reliability.

## Objectives

* Demonstrate the failure modes of pre-26ai DDL when duplicate objects exist or drops target missing objects, highlighting the need for manual PL/SQL exception handling.
* Implement repeatable DDL workflows using Oracle 26ai IF [NOT] EXISTS syntax for CREATE and DROP statements to show idempotent deployment patterns.
* Compare execution outcomes between legacy scripts and 26ai enhancements to emphasize reduced CI/CD friction and error handling overhead.
* Explore advanced behaviors (ALTER ... IF EXISTS, CREATE VIEW combinations) to document current limitations and gotchas for architects planning migrations.

## 1.   The Problem and the Pre-26ai Solution

We will Demonstrate the pain points in previous versions of Oracle Database.

__1.1 Setup – Create a table using below DDL command__

```sql

CREATE TABLE EMPLOYEE ( 
EMP_ID	NUMBER PRIMARY KEY,
EMP_NAME	VARCHAR2(50),
JOB_TITLE	VARCHAR2(50),
SALARY	NUMBER (10,2),
HIRE_DATE	DATE );

```

> *Table created.*


__1.2 Execute DDL Again- Run the same CREATE TABLE DDL second time__

```sql

CREATE TABLE EMPLOYEE IF NOT EXISTS ( 
EMP_ID	NUMBER PRIMARY KEY,
EMP_NAME	VARCHAR2(50),
JOB_TITLE	VARCHAR2(50),
SALARY	NUMBER (10,2),
HIRE_DATE	DATE );

```

> *ERROR at line 1:*
> *ORA-00955: name is already used by an existing object*


__1.3 Execute Cleanup – Run a DROP TABLE on a nonexistent table__

```sql

DROP TABLE EMPLOYEE_CONTACTS;

```

> *ERROR at line 1:*
> *Error: ORA-00942: table or view does not exist*


__1.4 Pre 26ai solution – The user needs to write a PL/SQL block to conditionally drop the table using *EXECUTE IMMEDIATE* and handle exception as well.__

```sql

BEGIN
    -- Attempt to drop the table if it exists
    EXECUTE IMMEDIATE 'DROP TABLE employee_contacts;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore error if table does not exist (ORA-00942)
        IF SQLCODE != -942 THEN
            RAISE;  -- re-raise other unexpected errors
        END IF;
END;
/

```

## 2.   Oracle 26ai and above, The Idempotent DDL Solution (IF [NOT] EXISTS)

__2.1 Setup – Create a table using below DDL command__

```sql

CREATE TABLE IF NOT EXISTS EMPLOYEE ( 
EMP_ID	NUMBER PRIMARY KEY,
EMP_NAME	VARCHAR2(50),
JOB_TITLE	VARCHAR2(50),
SALARY	NUMBER (10,2),
HIRE_DATE	DATE );

```

> *Statement processed.*


__2.2 Execute DDL Again - Run the same CREATE TABLE DDL second time in oracle 26ai__

```sql

CREATE TABLE IF NOT EXISTS EMPLOYEE ( 
EMP_ID	NUMBER PRIMARY KEY,
EMP_NAME	VARCHAR2(50),
JOB_TITLE	VARCHAR2(50),
SALARY	NUMBER (10,2),
HIRE_DATE	DATE );

```

> *Statement processed.*

Running CREATE TABLE ... IF NOT EXISTS on an existing table will not raise an error

__2.3 Execute Cleanup – Run a DROP TABLE on a nonexistent table__

```sql

DROP TABLE IF EXISTS EMPLOYEE;

```

> *Table dropped.*

__2.4 Execute Cleanup again – Run a DROP TABLE on a table which is already dropped (non-existent)__

```sql

DROP TABLE IF EXISTS EMPLOYEE;

```

> *Statement processed.*

Running DROP TABLE ... IF EXISTS on a table that doesn’t exist also executes successfully without any error.


##  3.	Advanced Scenarios and Gotchas

__3.1 Alter IF EXISTS example__

```sql

ALTER TABLE IF EXISTS employee ADD (address VARCHAR2(100));

```

> *Statement processed.*

```sql

ALTER TABLE IF EXISTS employee ADD (address VARCHAR2(100));

```

> *ERROR at line 1:*
> *ORA-01430: column being added already exists in table*

IF EXISTS only checks at the table level, not if the column exists. Running the same ALTER twice will still error on the column addition.


__3.2 OR REPLACE conflict with IF NOT EXISTS__

```sql

CREATE VIEW IF NOT EXISTS EMPOYEE_VIEW as SELECT * FROM EMPLOYEE;

```

> *Statement processed.*

```sql

CREATE or REPLACE VIEW IF NOT EXISTS EMPOYEE_VIEW as SELECT * FROM EMPLOYEE;

```

> *ERROR at line 1:*
> *ORA-11541: REPLACE and IF NOT EXISTS cannot coexist in the same DDL statement*

If you run CREATE VIEW IF NOT EXISTS or CREATE OR REPLACE VIEW both execute successfully without any error. But you cannot use both IF NOT EXISTS and OR REPLACE

## Learn More

* [Oracle Database 26ai Documentation](https://docs.oracle.com/en/learn/db23ai-sql-features/index.html)
* [PL/SQL Language Reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/lnpls/release-changes.html?utm_source=chatgpt.com)

## Acknowledgements

* **Author** - Satishbabu Gunukula
* **Last Updated By/Date** - Satishbabu Gunukula, March 2026