# How to Work with READ-ONLY PDB Users in Oracle Database 26ai for Secure Multitenancy?
Duration: 15 minutes

Oracle 26ai has introduced a new feature, READ-ONLY PDB user to improve security, developer productivity and performance. This helps multi-tenant environment where data access is critical. The READ-ONLY user cannot perform any DDL or DML activities.

## Create a Read-Only PDB User

To create a Read-Only PDB use the new READ ONLY clause in the CREATE USER statement.

Connect to PDB user

```sql
ALTER SESSION SET CONTAINER = my_pdb;
```

Create readonly “hr_user”

```sql
CREATE USER hr_user IDENTIFIED BY passwordxxx READ ONLY;
```

Grant create session to hr_user

```sql
GRANT CREATE SESSION TO hr_user;
```

Note that the “hr_user” cannot be able to perform below tasks:

*   User cannot run INSERT, DELETE, UPDATE or MERGE.
*   User Cannot create or modify tables, indexs, views or procedures
*   User cannot change roles or privileges
*   User cannot modify session-level settings

When you try any of the above user will receive “ORA-28194: Can perform read operations only" error.

Run below View to see if the user is read-only or not

```sql
SELECT username, read_only from dba_users where username='HR_USER';
```

| USERNAME  | READ_ONLY |
|-----------|-----------|
| HR_USER   |    YES    |


```sql
Connect hr_user/paswordxxx;
```

> _Connected._

```sql
CREATE TABLE employee_test (emp_id number, emp_name varchar2(50));
```

> _*
ERROR at line 1:
ORA-28194: Can perform read operations only_

```sql
DELETE FROM employee;
```

>_*
ERROR at line 1:
ORA-28194: Can perform read operations only_

Note that READ-ONLY users can execute PL/SQL if it doesn’t have any DDL or DML.

The below procedure rev_salary has update statement and cannot perform the operation.

```sql
exec REV_SALARY;
```

> _ERROR at line 1: <br>
ORA-28194: Can perform read operations only <br>
ORA-06512: at "HR\_USER.REV\_SALARY", line 3 <br>
ORA-06512: at line 1 <br>_

The READ-ONLY user can run a SELECT query without any issues.

```sql
SELECT emp_id, emp_name from employee;
```

| EMP_ID | EMP_NAME   |
|--------|------------|
| 1      | test_user1 |
| 2      | test_user2 |
| 3      | test_user3 |


The Read-Only PDB Users provide a clean way to enforce non-modifiability of users at the database level. This helps with read intensive applications, as these users restricted to only SELECT and users cannot perform any DDL or DML activities.


## Acknowledgements

* **Author** - Satishbabu Gunukula
* **Last Updated By/Date** - Satishbabu Gunukula, February 2026