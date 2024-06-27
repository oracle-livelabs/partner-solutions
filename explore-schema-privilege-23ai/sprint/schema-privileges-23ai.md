# How do I use Schema Privileges feature in Oracle 23ai?

**Community Contributed Workshop**

**Author:** *Nagatanmayee Gunukula*

Duration: 10 minute

Oracle 23ai offers “Schema Privileges” to simplify access control. This feature helps to simplify individual schema level privileges instead of granting system level (*ANY privileges) on all objects in a schema.  Users can grant privileges on their own schema without having any special privileges. This will help separation of duties with least privilege model by reducing the risk.

Before Oracle 23ai, users either grant privileges on each table, view to a schema, or grant “ANY” privilege.

To grant schema level privileges on other user schemes you need GRANT ANY SCHEMA or GRANT ANY PRIVILEGE system privilege.

1. Create SALES, NAT users in Oracle 23ai Database and grant CONNECT, RESOURCE privileges to SALES user and CREATE SESSION to NAT user.
	```
	SQL> <copy>CREATE USER sales IDENTIFIED BY salespwdXXXX QUOTA UNLIMITED ON USERS;
	</copy>
	User created.

	SQL> <copy>GRANT CONNECT, RESOURCE to sales;
	</copy>
	Grant succeeded.

	SQL> <copy>CREATE USER nat IDENTIFIED BY natpwdXXXX QUOTA UNLIMITED ON USERS;
	</copy>
	User created.

	SQL> <copy>GRANT CREATE SESSION to NAT;
	</copy>
	Grant succeeded.
	```

2. Connect to SALES user and create PRODUCT table.
	```
	SQL> <copy>CONNECT sales/salespwdXXXX;
	</copy>
	Connected.

	SQL> <copy>CREATE TABLE PRODUCT (
		PRODUCT_ID     		NUMBER(10),
		PRODUCT_NAME 	VARCHAR2(20),
		PRODUCT_LIST_PRICE	NUMBER(10,2),
		PRODUCT_STATUS       	VARCHAR2(15));
	</copy>
	Table Created.
	```

3. Insert data into the SALES.PRODUCT table.
	```
	<copy>
	INSERT INTO PRODUCT VALUES (1, 'Jacket', 39.99, 'InStock');
	INSERT INTO PRODUCT VALUES (2, 'Shirt', 25.99, 'InStock');
	INSERT INTO PRODUCT VALUES (3, 'Pant', 29.99, 'InStock');
	</copy>
	```

4. Grant “SELECT ANY TABLE” system privilege on SALES schema to NAT.
	```
	SQL> <copy>GRANT SELECT ANY TALBE ON SCHEMA sales to nat;
	</copy>
	Grant succeeded.
	```

5. Connect to NAT schema and select the PRODUCT table owned by SALES schema.
	```
	SQL> <copy>CONNECT nat/natpwdXXXX;
	</copy>
	User Connected.

	SQL> <copy>SELECT * FROM SALES.PRODUCT;
	</copy>

	PRODUCT_ID PRODUCT_NAME         PRODUCT_LIST_PRICE PRODUCT_STATUS
	---------- -------------------- ------------------ ---------------
			1 Jacket                            39.99 InStock
			2 Shirt                             25.99 InStock
			3 Pant                              29.99 InStock
	```

	User NAT is now able to select existing and future tables that are created under the SALES schema.

6. Users can query the following Dictionary views to get the information about Schema privileges.
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
* [Oracle Database New Features Documentation](https://docs.oracle.com/en/database/oracle/oracle-database/23/nfcoa/index.html)
* [Configuring Privilege and Role Authorization Documentation](https://docs.oracle.com/en/database/oracle/oracle-database/23/dbseg/configuring-privilege-and-role-authorization.html#GUID-1C2A996E-8D01-4B94-BE9F-E5042AA15B15)
* [Oracle Database 23c Security New Features](https://www.oracleracexpert.com/2023/12/webinar-oracle-database-23c-security.html)

>Note: In May 2024 *Oracle Database 23c* was renamed to **Oracle Database 23ai**. Learning materials referencing 23c are applicable to 23ai.

## Acknowledgements
* **Author** - Nagatanmayee Gunukula, LiveLabs Contributor
* **Last Updated By/Date** - Hope Fisher,  June 2024

