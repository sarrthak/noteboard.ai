import asyncio
import uuid
from loguru import logger
from passlib.context import CryptContext

from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.ticket import Ticket, TicketType, TicketStatus, TicketPriority
from app.services.knowledge_graph import KnowledgeGraphService
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.future import select

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

KNOWLEDGE_GRAPH_SERVICE = KnowledgeGraphService()


async def connect_knowledge_graph() -> None:
    """Connect to Neo4j with a localhost fallback for local shell execution."""
    try:
        await KNOWLEDGE_GRAPH_SERVICE.connect()
    except Exception:
        original_uri = settings.NEO4J_URI
        fallback_uri = original_uri.replace("neo4j", "localhost")
        if fallback_uri == original_uri:
            raise
        logger.warning(
            "Neo4j connection failed for '{}'. Retrying with '{}'.",
            original_uri,
            fallback_uri,
        )
        settings.NEO4J_URI = fallback_uri
        await KNOWLEDGE_GRAPH_SERVICE.connect()


async def create_db_session_factory() -> tuple[async_sessionmaker[AsyncSession], any]:
    """Create an async DB session factory with host/db fallback for local terminal runs."""
    db_names = [settings.POSTGRES_DB, "noteboard", "noteboard_db"]
    hosts = [settings.POSTGRES_SERVER, "localhost"]
    ports = [settings.POSTGRES_PORT, 5433, 5432]
    users = [settings.POSTGRES_USER, "noteboard", "postgres"]
    passwords = [settings.POSTGRES_PASSWORD, "noteboard_secret", "noteboard", "postgres"]

    # De-duplicate while preserving order.
    db_names = list(dict.fromkeys(db_names))
    hosts = list(dict.fromkeys(hosts))
    ports = list(dict.fromkeys(ports))
    users = list(dict.fromkeys(users))
    passwords = list(dict.fromkeys(passwords))

    last_error: Exception | None = None
    for host in hosts:
        for port in ports:
            for db_name in db_names:
                for user in users:
                    for password in passwords:
                        db_uri = (
                            f"postgresql+asyncpg://{user}:{password}"
                            f"@{host}:{port}/{db_name}"
                        )
                        engine = create_async_engine(db_uri, pool_pre_ping=True)
                        try:
                            async with engine.connect() as conn:
                                await conn.execute(text("SELECT 1"))
                            logger.info(
                                "Connected to Postgres at '{}:{}' db='{}' user='{}'.",
                                host, port, db_name, user,
                            )
                            session_factory = async_sessionmaker(
                                bind=engine,
                                class_=AsyncSession,
                                expire_on_commit=False,
                                autocommit=False,
                                autoflush=False,
                            )
                            return session_factory, engine
                        except Exception as exc:
                            last_error = exc
                            await engine.dispose()

    if last_error:
        raise last_error
    raise RuntimeError("Failed to initialize database session factory")

# 15+ complex tickets representing a microservices architecture
TICKETS_DATA = [
    {
        "id": "t1",
        "title": "API Gateway",
        "description": "Central entry point handling routing, rate limiting, and core auth verification.",
        "business_value": "Secure, fast routing of client traffic to internal domains.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.CRITICAL,
        "dependencies": []
    },
    {
        "id": "t2",
        "title": "User Auth Service",
        "description": "Microservice for managing users, MFA, JWT generation and validation.",
        "business_value": "Centralized, secure identity management.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.CRITICAL,
        "dependencies": ["API Gateway"]
    },
    {
        "id": "t3",
        "title": "Product Catalog DB",
        "description": "Document store for product information, inventory status, and variants.",
        "business_value": "Fast fetching of available SKUs for users.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.HIGH,
        "dependencies": ["API Gateway"]
    },
    {
        "id": "t4",
        "title": "Search Service v2",
        "description": "ElasticSearch integration pointing to the Product Catalog.",
        "business_value": "Advanced faceted search capabilities.",
        "type": TicketType.IMPROVEMENT,
        "priority": TicketPriority.HIGH,
        "dependencies": ["Product Catalog DB"]
    },
    {
        "id": "t5",
        "title": "Cart Service",
        "description": "Session-based temporary storage of pending orders utilizing Redis.",
        "business_value": "High-availability caching for uninterrupted shopping.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.HIGH,
        "dependencies": ["User Auth Service", "Product Catalog DB"]
    },
    {
        "id": "t6",
        "title": "Stripe Payment Gateway",
        "description": "Webhook handler and processing agent for external Stripe checkout flows.",
        "business_value": "Revenue capture.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.CRITICAL,
        "dependencies": ["Cart Service"]
    },
    {
        "id": "t7",
        "title": "Order Queue (RabbitMQ)",
        "description": "Message broker distributing successful checkout payloads to fulfillment.",
        "business_value": "Reliable asynchronous order processing.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.HIGH,
        "dependencies": ["Stripe Payment Gateway"]
    },
    {
        "id": "t8",
        "title": "Fulfillment Worker",
        "description": "Service consuming order queue messages to ping warehouse APIs.",
        "business_value": "Automated warehouse dispatch.",
        "type": TicketType.TASK,
        "priority": TicketPriority.HIGH,
        "dependencies": ["Order Queue (RabbitMQ)"]
    },
    {
        "id": "t9",
        "title": "Email Notification Worker",
        "description": "Consumes order queue payloads to fire off SendGrid receipts to customers.",
        "business_value": "Post-purchase customer communication.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.MEDIUM,
        "dependencies": ["Order Queue (RabbitMQ)"]
    },
    {
        "id": "t10",
        "title": "Invoice PDF Generator",
        "description": "Creates PDF files from receipt payloads and uploads to S3.",
        "business_value": "B2B compliance.",
        "type": TicketType.TASK,
        "priority": TicketPriority.LOW,
        "dependencies": ["Email Notification Worker"]
    },
    {
        "id": "t11",
        "title": "Analytics Data Lake",
        "description": "Snowflake cluster piping streaming event data for KPIs.",
        "business_value": "BI dashboards and metrics.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.MEDIUM,
        "dependencies": []
    },
    {
        "id": "t12",
        "title": "Telemetry & Tracing",
        "description": "OpenTelemetry configuration propagating span IDs across microservices.",
        "business_value": "System observability.",
        "type": TicketType.TASK,
        "priority": TicketPriority.MEDIUM,
        "dependencies": ["Analytics Data Lake"]
    },
    {
        "id": "t13",
        "title": "Recommendation Engine",
        "description": "Machine learning model predicting cross-sells based on cart contents.",
        "business_value": "Increased average order value.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.MEDIUM,
        "dependencies": ["Cart Service", "Product Catalog DB"]
    },
    {
        "id": "t14",
        "title": "Customer Support Dashboard",
        "description": "Internal CRM tool with read-only access to orders and user states.",
        "business_value": "Customer success operations.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.MEDIUM,
        "dependencies": ["User Auth Service", "Order Queue (RabbitMQ)"]
    },
    {
        "id": "t15",
        "title": "Refund Service",
        "description": "Payment rollback logic handling Stripe disputes and ledger balancing.",
        "business_value": "Customer satisfaction on returns.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.HIGH,
        "dependencies": ["Stripe Payment Gateway", "Customer Support Dashboard"]
    },
    {
        "id": "t16",
        "title": "Fraud Detection API",
        "description": "Pre-auth check rejecting suspiciously high-volume unverified checkouts.",
        "business_value": "Loss mitigation.",
        "type": TicketType.FEATURE,
        "priority": TicketPriority.CRITICAL,
        "dependencies": ["Stripe Payment Gateway"]
    }
]

async def seed_data():
    logger.info("Initializing Seed Script")

    # 1. Start Graph Service
    await connect_knowledge_graph()
    session_factory, db_engine = await create_db_session_factory()

    try:
        async with session_factory() as session:
            # 2. Ensure Demo User
            user_email = "demo@noteboard.ai"
            stmt = select(User).where(User.email == user_email)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()

            if not user:
                logger.info("Creating demo user...")
                hashed_pw = pwd_context.hash("password123")
                user = User(
                    id=uuid.uuid4(),
                    email=user_email,
                    full_name="Demo User",
                    hashed_password=hashed_pw,
                    is_active=True
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
            else:
                logger.info("Demo user already exists.")

            # 3. Ensure Project
            project_name = "E-Commerce Microservices Migration"
            stmt = select(Project).where(Project.name == project_name)
            result = await session.execute(stmt)
            project = result.scalar_one_or_none()

            if not project:
                logger.info("Creating project...")
                project = Project(
                    id=uuid.uuid4(),
                    name=project_name,
                    description="Migrating legacy monolithic app into a decoupled services fabric.",
                    owner_id=user.id
                )
                session.add(project)
                await session.commit()
                await session.refresh(project)
            else:
                logger.info("Project already exists. Deleting old tickets for clean slate...")
                stmt = select(Ticket).where(Ticket.project_id == project.id)
                result = await session.execute(stmt)
                old_tickets = result.scalars().all()
                for t in old_tickets:
                    await session.delete(t)
                await session.commit()

            # 4. Ensure Neo4j Project node exists
            project_id_str = str(project.id)
            await KNOWLEDGE_GRAPH_SERVICE.ensure_project_exists(project_id_str, project.name)

            logger.info(f"Adding {len(TICKETS_DATA)} tickets...")
            ticket_mapping = {}

            # First Passthrough: Create capabilities and DB entities
            for data in TICKETS_DATA:
                t_id = uuid.uuid4()
                # Set to OPEN so it mimics 'todo' for the frontend filter
                ticket = Ticket(
                    id=t_id,
                    title=data["title"],
                    description=data["description"],
                    business_value=data["business_value"],
                    type=data["type"],
                    priority=data["priority"],
                    status=TicketStatus.OPEN,
                    project_id=project.id,
                    creator_id=user.id,
                )
                session.add(ticket)
                
                # Form dict for knowledge graph service
                kg_payload = {
                    "id": str(ticket.id),
                    "project_id": project_id_str,
                    "title": ticket.title,
                    "description": ticket.description,
                    "business_value": ticket.business_value,
                    "type": ticket.type.value
                }
                
                await KNOWLEDGE_GRAPH_SERVICE.add_capability(kg_payload)
                ticket_mapping[data["title"]] = ticket
            
            await session.commit()

            # Second Passthrough: Create Graph Relationships
            logger.info("Creating graph relationships...")
            for data in TICKETS_DATA:
                target_name = data["title"]
                for source_name in data["dependencies"]:
                    # the target DEPENDS_ON source
                    await KNOWLEDGE_GRAPH_SERVICE.add_capability_relationship(
                        source_capability=target_name,
                        target_capability=source_name,
                        relationship_type="DEPENDS_ON",
                        project_id=project_id_str
                    )

    finally:
        await db_engine.dispose()
        await KNOWLEDGE_GRAPH_SERVICE.disconnect()
    logger.info("Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_data())
