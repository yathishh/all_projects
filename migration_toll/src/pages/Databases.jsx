import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DB_INFO, RDBMS_DBS, NOSQL_DBS } from "@/lib/dbConstants";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const DB_DETAILS = {
  oracle: { desc: "Enterprise-grade relational database with advanced features for high-volume transaction processing", features: ["PL/SQL", "RAC", "Partitioning", "MVCC", "Materialized Views"] },
  sql_server: { desc: "Microsoft's relational database with integrated BI tools and cloud integration", features: ["T-SQL", "SSRS", "SSIS", "AlwaysOn", "Columnstore"] },
  postgresql: { desc: "Advanced open-source RDBMS with robust extensibility and standards compliance", features: ["JSONB", "CTE", "Extensions", "Full-text Search", "Partitioning"] },
  mysql: { desc: "World's most popular open-source database with proven reliability", features: ["InnoDB", "Replication", "JSON Support", "Window Functions", "GIS"] },
  mariadb: { desc: "Community-developed fork of MySQL with enhanced features", features: ["Galera Cluster", "Columnstore", "Spider", "Aria Engine", "Temporal Tables"] },
  db2: { desc: "IBM's enterprise database with AI-infused capabilities", features: ["PureScale", "BLU Acceleration", "pureXML", "HADR", "Federation"] },
  sqlite: { desc: "Lightweight embedded database engine used worldwide", features: ["Zero Config", "Serverless", "Single File", "Full-text Search", "JSON1"] },
  mongodb: { desc: "Leading document-oriented NoSQL database for flexible schema design", features: ["Sharding", "Aggregation", "Change Streams", "Atlas Search", "Time Series"] },
  cassandra: { desc: "Distributed wide-column store for high availability at scale", features: ["Peer-to-peer", "Tunable Consistency", "Linear Scalability", "CQL", "Compaction"] },
  dynamodb: { desc: "AWS managed key-value and document database for serverless apps", features: ["Auto Scaling", "Global Tables", "DAX", "Streams", "TTL"] },
  couchbase: { desc: "Distributed document database with built-in cache and SQL-like queries", features: ["N1QL", "XDCR", "FTS", "Analytics", "Eventing"] },
  redis: { desc: "In-memory data structure store used as database, cache, and broker", features: ["Pub/Sub", "Streams", "Lua Scripting", "Cluster", "Modules"] },
  neo4j: { desc: "Native graph database for connected data and relationship queries", features: ["Cypher", "APOC", "GDS Library", "Causal Clustering", "Bloom"] },
  firebase: { desc: "Google's NoSQL cloud database for real-time sync across clients", features: ["Realtime Sync", "Offline Support", "Security Rules", "Cloud Functions", "Hosting"] },
  cosmosdb: { desc: "Azure's globally distributed multi-model database service", features: ["Multi-API", "Global Distribution", "Elastic Scale", "SLA-backed", "Serverless"] },
};

export default function Databases() {
  const [filter, setFilter] = useState("all");

  const { data: projects = [] } = useQuery({
    queryKey: ["migration-projects"],
    queryFn: () => base44.entities.MigrationProject.list("-updated_date", 100),
  });

  const getDbList = () => {
    if (filter === "rdbms") return RDBMS_DBS;
    if (filter === "nosql") return NOSQL_DBS;
    return [...RDBMS_DBS, ...NOSQL_DBS];
  };

  const getUsageCount = (db) => {
    return projects.filter(p => p.source_db_type === db || p.target_db_type === db).length;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Supported Databases</h1>
          <p className="text-sm text-muted-foreground mt-1">{Object.keys(DB_INFO).length} databases supported</p>
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({Object.keys(DB_INFO).length})</TabsTrigger>
            <TabsTrigger value="rdbms">RDBMS ({RDBMS_DBS.length})</TabsTrigger>
            <TabsTrigger value="nosql">NoSQL ({NOSQL_DBS.length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {getDbList().map((db) => {
          const info = DB_INFO[db];
          const details = DB_DETAILS[db];
          const usage = getUsageCount(db);
          return (
            <Card key={db} className="border border-border hover:shadow-md hover:border-primary/20 transition-all">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <h3 className="font-semibold">{info.name}</h3>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {info.category.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  {usage > 0 && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                      {usage} project{usage > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {details?.desc}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {details?.features?.map((f) => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {f}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}