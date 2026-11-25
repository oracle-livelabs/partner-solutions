# Property Graph and Spatial presenter walkthroughs

On **Data Foundation**, the shared **Graph & spatial context** white section has two grey buttons: **Property Graph** and **Spatial**. Each opens a four-step presenter pop-up with a short talk track, an interactive teaching example, Oracle support, and relevance to IncidentData.

Use Next/Back or the numbered step buttons. Close, Finish and Escape return keyboard focus to the tile. Both walkthroughs support narrow screens. Optional SQL examples are explanatory and are not executed; the interactive examples use invented local data and do not query the database.

## Property Graph

1. Explain nodes (vertices), relationships (edges), and properties with a person owning a bicycle.
2. Start at Alex or Sam and follow one or two hops to a bicycle and a cycle shop. Inspect node and edge properties. Sharing a shop does not establish a friendship; the diagram layout has no geographic meaning.
3. Explain Oracle SQL property graphs mapped to source tables, labels and properties, and `GRAPH_TABLE` patterns returning SQL rows. Show the optional person-to-bicycle-to-shop query.
4. Connect this to case links and evidence exploration. Visible links need source support; a graph drawing alone does not establish a relationship.

References: [CREATE PROPERTY GRAPH](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/create-property-graph.html), [GRAPH_TABLE](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/graph_table-operator.html).

## Spatial

1. Explain points, lines and polygons, along with coordinate systems and units.
2. Change the radius around a reference point, then switch to a patrol-area boundary. The invented kilometre grid illustrates why a nearby point can be outside an area. The initial 1 km radius includes one point; 3 km includes four; the area includes two.
3. Explain Oracle `SDO_GEOMETRY`, spatial metadata and indexes, and operations for distance and shape relationships. The optional SQL uses `SDO_GEOM.SDO_DISTANCE`; real data needs compatible coordinate systems, suitable tolerance and units.
4. Connect this to incident maps and geographic context. Physical proximity is distinct from vector similarity and does not prove a causal link.

References: [Spatial data types and metadata](https://docs.oracle.com/en/database/oracle/oracle-database/26/spatl/spatial-data-types-and-metadata.html), [SDO_GEOM.SDO_DISTANCE](https://docs.oracle.com/en/database/oracle/oracle-database/26/spatl/sdo_geom-sdo_distance.html).

## Verification

Build the frontend, then run `NODE_PATH=/tmp/crimedata-graph-browser.Sdn124/node_modules node scripts/test_graph_spatial_presenters_browser.cjs --local`. Omit `--local` to check the deployed app. Checks cover the shared section, graph hops and properties, spatial radius and area, optional SQL, mobile layout, keyboard focus, Escape/Finish/Close, reopening, and the existing Vector guide. Browser checks permit GET requests only.
