# E[xplore "Schema privileges" feature in Oracle 23c](..)?
Duration: 10 minute

## Answer

Oracle 23c Offers “Schema Privileges” to simplify Access control. This feature helps to simplify individual schema level privileges instead of granting system level (*ANY privileges) on all objects in a schema.  User can grant privileges on their own schema without having any special privileges. This will help separation of duties with least privilege model by reducing the risk. 

Before Oracle 23c, users either grant privileges on each table, view to a schema or grant “ANY” privilege.

To grant Schema level privileges on other user schemes you need GRANT ANY SCHEMA or GRAN ANY PRIVILEGE system privilege. 

## Task 1
Create SALES, NAT users in Oracle 23c Database and grant CONNECT, RESOURCE privileges to SALES user and CREATE SESSION to NAT user

```
<copy>
SQL> CREATE USER sales IDENTIFIED BY salespwdXXXX QUOTA UNLIMITED ON USERS;
User created.
SQL> GRANT CONNECT, RESOURCE to sales; 
Grant succeeded.

SQL> CREATE USER nat IDENTIFIED BY natpwdXXXX QUOTA UNLIMITED ON USERS;
User created.
SQL> GRANT CREATE SESSION to NAT; 
Grant succeeded.
</copy>
```

## Task 2
Connect to SALES user and create PRODUCT table.

```
<copy>
SQL> CONNECT sales/salespwdXXXX;
Connected. 

SQL> CREATE TABLE PRODUCT (
	PRODUCT_ID     		NUMBER(10),
	PRODUCT_NAME 	VARCHAR2(20),
	PRODUCT_LIST_PRICE	NUMBER(10,2),
	PRODUCT_STATUS       	VARCHAR2(15));
Table Created. 
</copy>
```

## Task 3
Insert data into SALES.PRODUCT table.
```
<copy>
INSERT INTO PRODUCT VALUES (1, 'Jacket', 39.99, 'InStock');
INSERT INTO PRODUCT VALUES (2, 'Shirt', 25.99, 'InStock');
INSERT INTO PRODUCT VALUES (3, 'Pant', 29.99, 'InStock');
</copy>
```

## Task 4
Grant “SELECT ANY TABLE” system privilege on SALES schema to NAT.
```
<copy>
SQL> GRANT SELECT ANY TALBE ON SCHEMA sales to nat;
Grant succeeded.
</copy>
```

## Task 5
Connect to NAT schema and select the PRODUCT table owned by SALES schema
```
<copy>
SQL>  CONNECT nat/natpwdXXXX;
User Connected.

SQL> SELECT * FROM SALES.PRODUCT;
PRODUCT_ID PRODUCT_NAME         PRODUCT_LIST_PRICE PRODUCT_STATUS
---------- -------------------- ------------------ ---------------
         1 Jacket                            39.99 InStock
         2 Shirt                             25.99 InStock
         3 Pant                              29.99 InStock

</copy>
```
User NAT able to select existing and future tables that are created under SALES schema.

## Task 6
User can query following Dictionary views to get the information about Schema privileges.
```
<copy>
DBA_SCHEMA_PRIVS
USER_SCHEMA_PRIVS
ROLE_SCHEMA_PRIVS
SESSION_SCHEMA_PRIVS
</copy>
```
This “Schema Privileges” feature provides least privilege model and helps to lower the risk if account is compromised. 

## Learn More

* [Oracle Documentation on Oracle 23c New features](https://docs.oracle.com/en/database/oracle/oracle-database/23/nfcoa/index.html)
* [Configuring Privilege and Role Authorization (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/configuring-privilege-and-role-authorization.html#GUID-1C2A996E-8D01-4B94-BE9F-E5042AA15B15)
* [Oracle Database 23c Security New Features](https://www.oracleracexpert.com/2023/12/webinar-oracle-database-23c-security.html)

## Acknowledgements
* **Author** - Nagatanmayee Gunukula
* **Last Updated By/Date** - Ramona Magadan,  June 2024
