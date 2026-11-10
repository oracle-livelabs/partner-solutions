# How do I query relationships as a graph with SQL Property Graphs in Oracle Database 26ai?

## Introduction

Some questions are about connections: which volunteers delivered to the same shelters, who recruited whom, and which donors supplied food to which shelters. Joins can answer these questions, but complex relationships may require many self-joins or recursive common table expressions (CTEs).

Oracle Database 26ai supports SQL Property Graphs, part of the SQL:2023 standard. A property graph defines vertices and edges over existing tables. Use `MATCH` patterns in `GRAPH_TABLE` to query the relationships; the graph is metadata over the tables, and no data is copied.

## Objectives

After this sprint, you will be able to:

- Define a SQL Property Graph over relational tables.
- Query paths, shared neighbors, and variable-length recruitment chains with GRAPH_TABLE.
- Combine graph queries with SQL aggregation and inspect graph metadata.

**Estimated Time:** 20 minutes

### Before you begin

Use an Oracle Database 26ai environment, such as FreeSQL / Live SQL, SQL Workshop on apex.oracle.com, an Always Free Autonomous Database, or Oracle Database 26ai Free.

### 1. Create the tables

Create tables for donors, volunteers, shelters, and pickups:

```sql
CREATE TABLE IF NOT EXISTS donors (
  donor_id NUMBER PRIMARY KEY,
  donor_name VARCHAR2(100) NOT NULL,
  donor_type VARCHAR2(20)
);

CREATE TABLE IF NOT EXISTS volunteers (
  volunteer_id NUMBER PRIMARY KEY,
  full_name VARCHAR2(100) NOT NULL,
  referred_by NUMBER REFERENCES volunteers
);

CREATE TABLE IF NOT EXISTS shelters (
  shelter_id NUMBER PRIMARY KEY,
  shelter_name VARCHAR2(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS pickups (
  pickup_id NUMBER PRIMARY KEY,
  volunteer_id NUMBER NOT NULL REFERENCES volunteers,
  donor_id NUMBER NOT NULL REFERENCES donors,
  shelter_id NUMBER NOT NULL REFERENCES shelters,
  kg NUMBER(7,2) NOT NULL,
  pickup_date DATE NOT NULL
);
```

### 2. Load sample data

Add donors, volunteers, shelters, and pickup records:

```sql
INSERT INTO donors VALUES
  (1, 'Moon Leaf Cafe', 'CAFE'),
  (2, 'Sunset Bakery', 'BAKERY'),
  (3, 'Safeway Grocers', 'GROCERY'),
  (4, 'Tom’s Kitchen', 'RESTAURANT');

-- Riya founded the group; the others were recruited in a chain.
INSERT INTO volunteers VALUES
  (1, 'Riya Patel', NULL),
  (2, 'Marco Lupin', 1),
  (3, 'Lin Chen', 2),
  (4, 'Priya Reddy', 3),
  (5, 'Ryan Blake', 1);

INSERT INTO shelters VALUES
  (1, 'Ocean View Shelter'),
  (2, 'Mission Community Kitchen'),
  (3, 'Sunrise Family Pantry');

INSERT INTO pickups VALUES
  (101, 1, 1, 1, 12.5, DATE '2026-10-05'),
  (102, 2, 2, 2, 20, DATE '2026-10-08'),
  (103, 4, 3, 3, 45, DATE '2026-10-12'),
  (104, 1, 4, 1, 18, DATE '2026-10-15'),
  (105, 5, 4, 1, 32, DATE '2026-10-19'),
  (106, 2, 2, 2, 9.5, DATE '2026-10-23'),
  (107, 3, 3, 3, 15, DATE '2026-10-27'),
  (108, 4, 4, 2, 11, DATE '2026-10-29'),
  (109, 3, 2, 1, 7, DATE '2026-11-01');

COMMIT;
```

### 3. Define the property graph

Map the tables to graph vertices and edges:

```sql
CREATE PROPERTY GRAPH rescue_graph
  VERTEX TABLES (
    donors KEY (donor_id)
      LABEL donor
      PROPERTIES (donor_id, donor_name, donor_type),
    volunteers KEY (volunteer_id)
      LABEL volunteer
      PROPERTIES (volunteer_id, full_name),
    shelters KEY (shelter_id)
      LABEL shelter
      PROPERTIES (shelter_id, shelter_name)
  )
  EDGE TABLES (
    pickups AS collected_from
      KEY (pickup_id)
      SOURCE KEY (volunteer_id) REFERENCES volunteers (volunteer_id)
      DESTINATION KEY (donor_id) REFERENCES donors (donor_id)
      LABEL collected_from PROPERTIES (pickup_id, kg, pickup_date),
    pickups AS delivered_to
      KEY (pickup_id)
      SOURCE KEY (volunteer_id) REFERENCES volunteers (volunteer_id)
      DESTINATION KEY (shelter_id) REFERENCES shelters (shelter_id)
      LABEL delivered_to PROPERTIES (pickup_id, kg, pickup_date),
    volunteers AS referred_by
      KEY (volunteer_id)
      SOURCE KEY (volunteer_id) REFERENCES volunteers (volunteer_id)
      DESTINATION KEY (referred_by) REFERENCES volunteers (volunteer_id)
      LABEL referred_by
  );
```

Notice that:

- The graph definition is stored in the data dictionary. Queries read the underlying tables.
- One table can define several edge types. Here, `pickups` defines both `collected_from` and `delivered_to`.
- A self-referencing column can define an edge. Here, `referred_by` represents the volunteer recruitment chain.

### 4. Match a simple path

Show each donor-to-volunteer-to-shelter journey. The `WHERE` clause matches the two edges that came from the same pickup:

```sql
SELECT *
FROM GRAPH_TABLE (
  rescue_graph
  MATCH
    (d IS donor) <-[c IS collected_from]- (v IS volunteer)
      -[t IS delivered_to]-> (s IS shelter)
  WHERE c.pickup_id = t.pickup_id
  COLUMNS (
    d.donor_name AS donor,
    v.full_name AS volunteer,
    s.shelter_name AS shelter,
    c.kg AS kg,
    c.pickup_date AS pickup_date
  )
)
ORDER BY pickup_date;
```

In the pattern, parentheses represent vertices, arrows represent directed edges, and `IS` filters by label. The `COLUMNS` clause returns each match as a row.

### 5. Find shared neighbors

Find pairs of volunteers who delivered to the same shelter. This can help plan carpools and backup drivers.

```sql
SELECT shelter, volunteer_1, volunteer_2
FROM GRAPH_TABLE (
  rescue_graph
  MATCH
    (v1 IS volunteer) -[IS delivered_to]-> (s IS shelter)
      <-[IS delivered_to]- (v2 IS volunteer)
  WHERE v1.volunteer_id < v2.volunteer_id
  COLUMNS (
    s.shelter_name AS shelter,
    v1.full_name AS volunteer_1,
    v2.full_name AS volunteer_2
  )
)
GROUP BY shelter, volunteer_1, volunteer_2
ORDER BY shelter;
```

The comparison `v1.volunteer_id < v2.volunteer_id` avoids returning the same pair in both orders. A join-based query would need to join `pickups` to itself and look up both volunteers and the shelter.

### 6. Walk a variable-length chain

Find the recruiters in Priya Reddy’s chain, up to three steps back:

```sql
SELECT recruiter
FROM GRAPH_TABLE (
  rescue_graph
  MATCH
    (p IS volunteer WHERE p.full_name = 'Priya Reddy')
      -[IS referred_by]->{1,3}
      (r IS volunteer)
  COLUMNS (r.full_name AS recruiter)
);
```

The result follows this chain:

- Lin Chen (one step back)
- Marco Lupin (two steps back)
- Riya Patel (three steps back)

The `{1,3}` quantifier follows the edge from one to three times. To find everyone Riya Patel recruited, directly or indirectly, reverse the edge direction:

```sql
SELECT recruit
FROM GRAPH_TABLE (
  rescue_graph
  MATCH
    (a IS volunteer WHERE a.full_name = 'Riya Patel')
      <-[IS referred_by]-{1,5}
      (r IS volunteer)
  COLUMNS (r.full_name AS recruit)
);
```

### 7. Combine graph results with regular SQL

`GRAPH_TABLE` returns rows that you can aggregate, join, and filter like other SQL row sources. This query calculates the kilograms and trip count for each donor type and shelter:

```sql
SELECT donor_type, shelter, SUM(kg) AS total_kg, COUNT(*) AS trips
FROM GRAPH_TABLE (
  rescue_graph
  MATCH
    (d IS donor) <-[c IS collected_from]- (v IS volunteer)
      -[t IS delivered_to]-> (s IS shelter)
  WHERE c.pickup_id = t.pickup_id
  COLUMNS (
    d.donor_type AS donor_type,
    s.shelter_name AS shelter,
    c.kg AS kg
  )
)
GROUP BY donor_type, shelter
ORDER BY total_kg DESC;
```

### 8. Inspect the graph in the data dictionary

List the graph and its elements:

```sql
SELECT graph_name
FROM user_property_graphs;

SELECT element_name, element_kind, object_name
FROM user_pg_elements
WHERE graph_name = 'RESCUE_GRAPH';
```

Graph Studio on Autonomous Database and the Graph Visualization plug-in for APEX can display query results as an interactive network diagram.

### 9. Clean up

Drop the property graph, then drop the tables:

```sql
DROP PROPERTY GRAPH rescue_graph;
DROP TABLE IF EXISTS pickups PURGE;
DROP TABLE IF EXISTS shelters PURGE;
DROP TABLE IF EXISTS volunteers PURGE;
DROP TABLE IF EXISTS donors PURGE;
```

### 10. Summary

In this sprint, you learned how to:

- Map existing tables to graph vertices and edges with `CREATE PROPERTY GRAPH`, without copying their data.
- Turn graph patterns into rows with `GRAPH_TABLE`, `MATCH`, and `COLUMNS`.
- Use one table for several edge types and a self-referencing column for a hierarchy.
- Query variable-length paths with quantifiers such as `{1,3}`.
- Combine graph queries with `GROUP BY`, joins, and other SQL.

## Learn More

- [Introduction to SQL Property Graphs — Oracle AI Database Graph Developer’s Guide](https://docs.oracle.com/en/database/oracle/property-graph/26.4/spgdg/sql-property-graph.html)
- [SQL Graph Queries — Oracle AI Database Graph Developer’s Guide](https://docs.oracle.com/en/database/oracle/property-graph/26.4/spgdg/sql-graph-queries.html)

See these features in the FoodRescue Network APEX project, whose `fr_donors`, `fr_volunteers`, `fr_shelters`, and `fr_pickups` tables have the same shape.

## Acknowledgements

- **Author** — Nagatanmayee Gunukula
- **Last Updated By/Date** — November 2026
