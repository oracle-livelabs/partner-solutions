# Explore "SELECT without FROM" feature in Oracle 23c
Duration: 10 minute

## Answer

Oracle 23c Offers “SELECT without FROM” to simplifies SELECT statements without a FROM Clause. This feature helps with simplified syntax, performance, SQL code portability. It offers great flexibility by reshaping the way queries are formulated without specifying a table. 

In Oracle, The DUAL table often used for scenarios where table reference is required Now Developers, Database Admins can query metadata without using “From DUAL” and query from multiple tables reducing complexity. It helps to reduce the chances of typos, users time and effort.  

Databases such as MS SQL Server, MYSQL…etc.  support without FROM clause, this will help improve SQL Code portability between different database vendors. It simplifies query constructions and migration across different database platforms as well.  

Here are some potential benefits of a "SELECT without FROM" feature in Oracle 23c

## 1.	Select current date for easier data Manipulation
```
<copy>
SQL> SELECT CURRENT_DATE;
SYSDATE
-------------------
2024-03-25:16:56:41
</copy>
```

## 2.	Mathematical operations or calculations without involving table data.
```
<copy>
SQL> SELECT 5*5;

       5*5
----------
        25

</copy>
```

## 3.	PL/SQL Block without using FROM Clause.
```
<copy>
SQL> CREATE SEQUENCE empno_seq INCREMENT BY 1 START WITH 1 MINVALUE 1 MAXVALUE 1000;

Sequence created.

SQL> declare
v1 number;
begin
select empno_seq.nextval into v1;
dbms_output.put_line ('v1= '||v1);
end;
/  
v1= 1

PL/SQL procedure successfully completed.
</copy>
```

## 4.	Built-in or User defined Functions to perform operations or retrieve vales.
```
SQL> SELECT DBMS_RANDOM.VALUE() as random_number;

RANDOM_NUMBER
-------------
   .798816772
```

## 5.	String Manipulations or conversions without relying on table data.
```
<copy>
SQL> SELECT UPPER('oracle') AS uppercase_text;

UPPER
------
ORACLE
</copy>
```

## 6.	Conditional or logical expressions without using a table.
```
<copy>
SQL> SELECT CASE WHEN 10 > 5 THEN 'True' ELSE 'False' END AS result;

RESUL
-----
True
</copy>
```

Unlock all Oracle Database 23c by upgrading your database and take advantage of all new features. 

## Learn More

* [Oracle Database 23c New Features Guide ](https://docs.oracle.com/en/database/oracle/oracle-database/23/nfcoa/oracle-database-23c-new-features-guide.pdf)
* [SELECT without FROM Clause in Oracle 23c ](https://www.oracleracexpert.com/2023/08/select-without-from-clause-in-oracle-23c.html)
* [Oracle Documentation on Oracle 23c New features](https://docs.oracle.com/en/database/oracle/oracle-database/23/nfcoa/index.html)
* [Oracle Database 23c Security New Features](https://www.oracleracexpert.com/2023/12/webinar-oracle-database-23c-security.html)

## Acknowledgements
* **Author** - Nagatanmayee Gunukula
* **Last Updated By/Date** - Ramona Magadan,  June 2024
