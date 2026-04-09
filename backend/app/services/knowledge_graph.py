"""
Knowledge Graph service using Neo4j for capability tracking.
"""

from typing import Any, Optional
from uuid import UUID

from loguru import logger
from neo4j import AsyncGraphDatabase
from neo4j.exceptions import ServiceUnavailable

from app.core.config import settings


class KnowledgeGraphService:
    """Neo4j-based knowledge graph for project capabilities."""

    def __init__(self):
        self._driver = None

    async def connect(self) -> None:
        """Connect to Neo4j database."""
        try:
            self._driver = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
            )
            # Verify connectivity
            async with self._driver.session() as session:
                await session.run("RETURN 1")
            logger.info("Connected to Neo4j")
        except ServiceUnavailable as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            raise

    async def disconnect(self) -> None:
        """Disconnect from Neo4j database."""
        if self._driver:
            await self._driver.close()
            logger.info("Disconnected from Neo4j")

    @property
    def driver(self):
        """Get Neo4j driver."""
        if not self._driver:
            raise RuntimeError("Neo4j driver not initialized. Call connect() first.")
        return self._driver

    async def ensure_project_exists(self, project_id: str, project_name: str = "") -> None:
        """Ensure a Project node exists in the graph."""
        query = """
        MERGE (p:Project {id: $project_id})
        ON CREATE SET p.name = $project_name, p.created_at = datetime()
        ON MATCH SET p.name = CASE WHEN $project_name <> '' THEN $project_name ELSE p.name END
        """
        async with self.driver.session() as session:
            await session.run(
                query,
                project_id=project_id,
                project_name=project_name,
            )

    async def add_capability(self, ticket: dict) -> None:
        """
        Add a capability node to the knowledge graph from a ticket.
        
        Args:
            ticket: Dict containing title, description, business_value, type, project_id
        """
        project_id = str(ticket.get("project_id", ""))
        title = ticket.get("title", "")
        description = ticket.get("description", "")
        business_value = ticket.get("business_value", "")
        ticket_type = ticket.get("type", "feature")
        ticket_id = str(ticket.get("id", ""))

        if not project_id or not title:
            logger.warning("Cannot add capability: missing project_id or title")
            return

        # Create capability node and link to project
        query = """
        MERGE (p:Project {id: $project_id})
        MERGE (c:Capability {name: $title, project_id: $project_id})
        ON CREATE SET 
            c.description = $description,
            c.business_value = $business_value,
            c.type = $ticket_type,
            c.ticket_id = $ticket_id,
            c.created_at = datetime()
        ON MATCH SET
            c.description = $description,
            c.business_value = $business_value,
            c.type = $ticket_type,
            c.ticket_id = $ticket_id,
            c.updated_at = datetime()
        MERGE (c)-[:BELONGS_TO]->(p)
        """

        try:
            async with self.driver.session() as session:
                await session.run(
                    query,
                    project_id=project_id,
                    title=title,
                    description=description,
                    business_value=business_value,
                    ticket_type=ticket_type,
                    ticket_id=ticket_id,
                )
            logger.info(f"Added capability '{title}' to knowledge graph")
        except Exception as e:
            logger.error(f"Failed to add capability to graph: {e}")
            # Don't raise - graph failures shouldn't block ticket creation

    async def add_capability_relationship(
        self, 
        source_capability: str, 
        target_capability: str, 
        relationship_type: str,
        project_id: str,
    ) -> None:
        """
        Add a relationship between two capabilities.
        
        Args:
            source_capability: Name of the source capability
            target_capability: Name of the target capability  
            relationship_type: Type of relationship (e.g., DEPENDS_ON, ENABLES, RELATED_TO)
            project_id: Project ID for scoping
        """
        # Allowlist relationship types to prevent Cypher injection
        allowed_types = {"DEPENDS_ON", "ENABLES", "EXTENDS", "RELATED_TO", "CONFLICTS_WITH"}
        if relationship_type not in allowed_types:
            logger.warning(f"Invalid relationship type '{relationship_type}', defaulting to RELATED_TO")
            relationship_type = "RELATED_TO"

        query = f"""
        MATCH (s:Capability {{name: $source, project_id: $project_id}})
        MATCH (t:Capability {{name: $target, project_id: $project_id}})
        MERGE (s)-[r:{relationship_type}]->(t)
        ON CREATE SET r.created_at = datetime()
        """

        try:
            async with self.driver.session() as session:
                await session.run(
                    query,
                    source=source_capability,
                    target=target_capability,
                    project_id=project_id,
                )
            logger.info(f"Added relationship {source_capability} -{relationship_type}-> {target_capability}")
        except Exception as e:
            logger.error(f"Failed to add relationship: {e}")

    async def get_project_graph(self, project_id: str) -> dict[str, Any]:
        """
        Get the full knowledge graph for a project.
        
        Returns format suitable for d3.js / react-force-graph:
        {
            "nodes": [{"id": "...", "name": "...", "group": "capability", ...}],
            "links": [{"source": "...", "target": "...", "type": "DEPENDS_ON"}]
        }
        """
        # Query all capabilities and their dependency relationships
        query = """
        MATCH (p:Project {id: $project_id})<-[:BELONGS_TO]-(c:Capability)
        OPTIONAL MATCH (c)-[r:DEPENDS_ON|ENABLES|EXTENDS|RELATED_TO]->(d:Capability)
        RETURN 
            c.name AS c_name,
            c.description AS c_description,
            c.business_value AS c_business_value,
            c.type AS c_type,
            c.ticket_id AS c_ticket_id,
            type(r) AS rel_type,
            d.name AS d_name,
            d.description AS d_description,
            d.business_value AS d_business_value,
            d.type AS d_type,
            d.ticket_id AS d_ticket_id
        """

        nodes: dict[str, dict] = {}  # Use dict for deduplication by name
        links: list[dict] = []
        seen_links: set[tuple] = set()  # Track unique links

        try:
            async with self.driver.session() as session:
                result = await session.run(query, project_id=project_id)
                records = await result.data()

                for record in records:
                    # Add source capability node (c)
                    c_name = record.get("c_name")
                    if c_name and c_name not in nodes:
                        nodes[c_name] = {
                            "id": c_name,
                            "name": c_name,
                            "group": "capability",
                            "description": record.get("c_description", ""),
                            "business_value": record.get("c_business_value", ""),
                            "type": record.get("c_type", "feature"),
                            "ticket_id": record.get("c_ticket_id"),
                        }

                    # Add target dependency node (d) if exists
                    d_name = record.get("d_name")
                    if d_name and d_name not in nodes:
                        nodes[d_name] = {
                            "id": d_name,
                            "name": d_name,
                            "group": "capability",
                            "description": record.get("d_description", ""),
                            "business_value": record.get("d_business_value", ""),
                            "type": record.get("d_type", "feature"),
                            "ticket_id": record.get("d_ticket_id"),
                        }

                    # Add link if relationship exists (deduplicate)
                    rel_type = record.get("rel_type")
                    if c_name and d_name and rel_type:
                        link_key = (c_name, d_name, rel_type)
                        if link_key not in seen_links:
                            seen_links.add(link_key)
                            links.append({
                                "source": c_name,
                                "target": d_name,
                                "type": rel_type,
                            })

            # Add project node as the root
            nodes[project_id] = {
                "id": project_id,
                "name": f"Project",
                "group": "project",
            }

            logger.info(f"Retrieved graph for project {project_id}: {len(nodes)} nodes, {len(links)} links")

            return {
                "nodes": list(nodes.values()),
                "links": links,
            }

        except Exception as e:
            logger.error(f"Failed to get project graph: {e}")
            return {"nodes": [], "links": []}

    async def delete_capability(self, capability_name: str, project_id: str) -> bool:
        """Delete a capability and its relationships."""
        query = """
        MATCH (c:Capability {name: $name, project_id: $project_id})
        DETACH DELETE c
        RETURN count(c) AS deleted
        """

        try:
            async with self.driver.session() as session:
                result = await session.run(
                    query,
                    name=capability_name,
                    project_id=project_id,
                )
                record = await result.single()
                deleted = record["deleted"] if record else 0
                return deleted > 0
        except Exception as e:
            logger.error(f"Failed to delete capability: {e}")
            return False

    async def get_existing_capabilities(self, project_id: str) -> list[dict]:
        """
        Get all existing capabilities for a project.
        
        Returns:
            List of capability dicts with name, description, type
        """
        query = """
        MATCH (c:Capability {project_id: $project_id})
        RETURN c.name AS name, c.description AS description, c.type AS type
        """

        try:
            async with self.driver.session() as session:
                result = await session.run(query, project_id=project_id)
                records = await result.data()
                return [
                    {
                        "name": r["name"],
                        "description": r.get("description", ""),
                        "type": r.get("type", "feature"),
                    }
                    for r in records
                ]
        except Exception as e:
            logger.error(f"Failed to get existing capabilities: {e}")
            return []

    async def add_relationships_batch(
        self, 
        relationships: list[dict], 
        project_id: str
    ) -> int:
        """
        Add multiple relationships in a batch.
        
        Args:
            relationships: List of {"source": "...", "target": "...", "type": "..."}
            project_id: Project ID for scoping
            
        Returns:
            Number of relationships created
        """
        if not relationships:
            return 0

        created_count = 0
        for rel in relationships:
            source = rel.get("source", "")
            target = rel.get("target", "")
            rel_type = rel.get("type", "RELATED_TO")
            
            # Validate relationship type
            valid_types = ["DEPENDS_ON", "ENABLES", "EXTENDS", "RELATED_TO", "CONFLICTS_WITH"]
            if rel_type not in valid_types:
                rel_type = "RELATED_TO"

            if source and target and source != target:
                try:
                    await self.add_capability_relationship(
                        source_capability=source,
                        target_capability=target,
                        relationship_type=rel_type,
                        project_id=project_id,
                    )
                    created_count += 1
                except Exception as e:
                    logger.warning(f"Failed to create relationship {source}->{target}: {e}")

        logger.info(f"Created {created_count}/{len(relationships)} relationships")
        return created_count

    async def get_capability_dependencies(self, ticket_id: str) -> list[dict]:
        """
        Get dependencies and relationships for a capability identified by its ticket ID.

        Returns list of dicts: [{"name": ..., "relationship": ..., "direction": "depends_on"|"depended_by"}]
        """
        query = """
        MATCH (c:Capability {ticket_id: $ticket_id})
        OPTIONAL MATCH (c)-[r1:DEPENDS_ON|ENABLES|EXTENDS|RELATED_TO]->(t:Capability)
        OPTIONAL MATCH (s:Capability)-[r2:DEPENDS_ON|ENABLES|EXTENDS|RELATED_TO]->(c)
        RETURN
            c.name AS capability_name,
            collect(DISTINCT {name: t.name, relationship: type(r1), direction: 'depends_on'}) AS outgoing,
            collect(DISTINCT {name: s.name, relationship: type(r2), direction: 'depended_by'}) AS incoming
        """
        try:
            async with self.driver.session() as session:
                result = await session.run(query, ticket_id=ticket_id)
                record = await result.single()
                if not record:
                    return []
                deps: list[dict] = []
                for item in record["outgoing"]:
                    if item.get("name"):
                        deps.append(item)
                for item in record["incoming"]:
                    if item.get("name"):
                        deps.append(item)
                return deps
        except Exception as e:
            logger.warning(f"Failed to get capability dependencies: {e}")
            return []


# Singleton instance
knowledge_graph_service = KnowledgeGraphService()
