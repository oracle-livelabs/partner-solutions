# How do I use SELECT without FROM in Oracle 23ai?

**Community Contributed Workshop**

**Author:** *Nagatanmayee Gunukula*

Duration: 10 minute

Oracle 23ai offers “SELECT without FROM” to simplify SELECT statements without a FROM clause. This feature helps with simplified syntax, performance, and SQL code portability. It offers great flexibility by reshaping the way queries are formulated without specifying a table.

In Oracle, the DUAL table was used for scenarios where table reference is required. Now Developers and Database Admins can query metadata without using 'from DUAL' and query from multiple tables, reducing complexity. It helps to reduce the chances of typos, users' time, and effort.

Databases such as Microsoft SQL Server, MYSQL, etc. support without FROM clause - this will help improve SQL Code portability between different database vendors. It simplifies query constructions and migration across different database platforms as well.

Here are some potential benefits of a "SELECT without FROM" feature in Oracle 23ai

1. Select current date for easier data manipulation.
        ```
        SQL> <copy>SELECT CURRENT_DATE;
        </copy>

        SYSDATE
        -------------------
        2024-03-25:16:56:41
        ```

2. Mathematical operations or calculations without involving table data.
        ```
        SQL> <copy>SELECT 5*5;
        </copy>

               5*5
        ----------
                25
        ```

3. PL/SQL block without using FROM clause.
        ```
        SQL> <copy>CREATE SEQUENCE empno_seq INCREMENT BY 1 START WITH 1 MINVALUE 1 MAXVALUE 1000;
        </copy>
        Sequence created.s
        ```
        ```
        SQL> <copy>declare
        v1 number;
        begin
        select empno_seq.nextval into v1;
        dbms_output.put_line ('v1= '||v1);
        end;
        /
        </copy>
        v1= 1

        PL/SQL procedure successfully completed.
        ```

4. Built-in or user defined functions to perform operations or retrieve values.
        ```
        SQL> <copy>SELECT DBMS_RANDOM.VALUE() as random_number;
        </copy>

        RANDOM_NUMBER
        -------------
        .798816772
        ```

5. String manipulations or conversions without relying on table data.
        ```
        SQL> <copy>SELECT UPPER('oracle') AS uppercase_text;
        </copy>

        UPPER
        ------
        ORACLE
        ```

6. Conditional or logical expressions without using a table.
        ```
        SQL> <copy>SELECT CASE WHEN 10 > 5 THEN 'True' ELSE 'False' END AS result;
        </copy>

        RESULT
        -----
        True
        ```

Unlock all Oracle Database 23ai by upgrading your database and taking advantage of all the new features.

## Learn More

* [Oracle Database New Features Guide - Release 23ai](https://docs.oracle.com/en/database/oracle/oracle-database/23/nfcoa/oracle-database-23c-new-features-guide.pdf)
* [SELECT without FROM Clause in Oracle 23c ](https://www.oracleracexpert.com/2023/08/select-without-from-clause-in-oracle-23c.html)
* [Oracle Database New Features Documentation](https://docs.oracle.com/en/database/oracle/oracle-database/23/nfcoa/index.html)
* [Oracle Database 23c Security New Features](https://www.oracleracexpert.com/2023/12/webinar-oracle-database-23c-security.html)

>Note: In May 2024 *Oracle Database 23c* was renamed to **Oracle Database 23ai**. Learning materials referencing 23c are applicable to 23ai.

## Acknowledgements
* **Author** - Nagatanmayee Gunukula, LiveLabs Contributor
* **Last Updated By/Date** - Hope Fisher,  June 2024
