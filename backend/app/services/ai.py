"""
AI Service for audio transcription and ticket synthesis.
"""

import json
import os
import tempfile
from typing import Any

from fastapi import UploadFile
from loguru import logger
from openai import AsyncOpenAI

from app.core.config import settings


class AIService:
    """Service for AI-powered features using OpenAI APIs."""

    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    async def transcribe_audio(self, file: UploadFile) -> str:
        """
        Transcribe audio file using OpenAI Whisper.
        
        Args:
            file: The uploaded audio file
            
        Returns:
            Transcribed text
        """
        # Save file temporarily
        suffix = os.path.splitext(file.filename or ".wav")[1]
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            logger.info(f"Transcribing audio file: {file.filename}")
            
            with open(tmp_path, "rb") as audio_file:
                transcription = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            logger.info("Audio transcription completed successfully")
            return transcription
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            raise
        finally:
            # Clean up temp file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    async def synthesize_tickets(
        self, 
        transcript: str, 
        project_context: str = ""
    ) -> dict[str, Any]:
        """
        Convert transcript into structured tickets using GPT.
        
        Args:
            transcript: The meeting transcript
            project_context: Optional context about the project
            
        Returns:
            Dictionary containing list of tickets with relationships
        """
        system_prompt = """You are an expert Software Architect. Analyze the transcript and extract 'Capabilities' (User Stories).

You MUST identify relationships between these capabilities to build a Knowledge Graph.

**Relationship Types:**
1. **Hard Dependencies (depends_on)**: If Capability A must happen before Capability B can be built.
   - Example: 'User Profile' depends_on 'User Authentication'
   - Example: 'Payment Processing' depends_on 'User Authentication'
   - Include references to existing systems mentioned (e.g., 'Auth', 'Legacy API', 'Database')

2. **Thematic Links (related_to)**: If Capabilities A and B are conceptually related or part of the same feature area.
   - Example: 'Geolocation Service' related_to 'Ride Request'
   - Example: 'Push Notifications' related_to 'Order Tracking'
   - These are NOT dependencies, just logical groupings

For each capability, provide:
- title: Clear, concise name (max 100 chars)
- description: Detailed description with acceptance criteria
- business_value_metric: Specific, measurable business impact
- priority: "high", "medium", or "low"
- type: "feature" or "bug"
- depends_on: List of capability names that MUST exist before this one
- related_to: List of capability names that are thematically related

Return JSON with this EXACT schema:
{
    "tickets": [
        {
            "title": "string",
            "description": "string",
            "business_value_metric": "string",
            "priority": "high" | "medium" | "low",
            "type": "feature" | "bug",
            "depends_on": ["string (capability name)"],
            "related_to": ["string (capability name)"]
        }
    ]
}

IMPORTANT:
- Be aggressive in finding relationships - most capabilities should have at least one connection
- depends_on and related_to should reference OTHER capability titles from this same list
- Don't invent capabilities not mentioned in the transcript
- Ensure depends_on forms a valid DAG (no circular dependencies)
- related_to can be bidirectional (if A relates to B, B should relate to A)"""

        user_message = f"""Project Context: {project_context or 'General software project'}

Meeting Transcript:
{transcript}

Please analyze this transcript and extract all actionable capabilities.
Identify BOTH hard dependencies (depends_on) AND thematic relationships (related_to) between them.
Be thorough in finding connections - a well-connected Knowledge Graph is the goal."""

        try:
            logger.info("Synthesizing tickets from transcript")
            
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Normalize the response to ensure consistent field names
            tickets = result.get("tickets", [])
            for ticket in tickets:
                # Ensure depends_on is always a list
                if "depends_on" not in ticket:
                    ticket["depends_on"] = []
                # Ensure related_to is always a list
                if "related_to" not in ticket:
                    ticket["related_to"] = []
                # Legacy support: merge old 'dependencies' into 'depends_on'
                if "dependencies" in ticket:
                    ticket["depends_on"] = list(set(ticket["depends_on"] + ticket.get("dependencies", [])))
                    del ticket["dependencies"]
                # Map business_value_metric to business_value for backward compatibility
                if "business_value_metric" in ticket and "business_value" not in ticket:
                    ticket["business_value"] = ticket["business_value_metric"]
                # Normalize priority to lowercase
                if "priority" in ticket:
                    ticket["priority"] = ticket["priority"].lower()
                # Normalize type to lowercase
                if "type" in ticket:
                    ticket["type"] = ticket["type"].lower()
            
            logger.info(f"Synthesized {len(tickets)} tickets with relationships")
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse GPT response: {e}")
            return {"tickets": [], "error": "Failed to parse response"}
        except Exception as e:
            logger.error(f"Ticket synthesis error: {e}")
            raise

    async def analyze_capability_relationships(
        self,
        new_capabilities: list[dict],
        existing_capabilities: list[dict] | None = None,
    ) -> list[dict]:
        """
        Analyze relationships between capabilities using AI.
        
        This is the PRIMARY method for discovering relationships between capabilities.
        It should be called when confirming tickets to find all connections.
        
        Args:
            new_capabilities: List of newly created capabilities
            existing_capabilities: List of existing capabilities in the project (optional)
            
        Returns:
            List of relationships: [{"source": "...", "target": "...", "type": "..."}]
        """
        if len(new_capabilities) < 2 and not existing_capabilities:
            return []
        
        existing_capabilities = existing_capabilities or []
        all_capabilities = new_capabilities + existing_capabilities
        new_titles = {c.get("title", c.get("name", "")) for c in new_capabilities}
        
        system_prompt = """You are a Software Architect building a Knowledge Graph of system capabilities.

TASK: Analyze the provided capabilities and identify ALL meaningful relationships between them.

RELATIONSHIP TYPES (in order of specificity):
1. **DEPENDS_ON**: Hard dependency - Source REQUIRES target to function.
   - "Payment Processing" DEPENDS_ON "User Authentication" (can't pay without being logged in)
   - "Order History" DEPENDS_ON "Order Management" (need orders to have history)

2. **ENABLES**: Source unlocks or enables target functionality.
   - "User Authentication" ENABLES "User Profile" (being logged in enables profile access)
   - "Inventory System" ENABLES "Stock Alerts" (inventory data enables alerting)

3. **EXTENDS**: Source extends or enhances target with additional functionality.
   - "Advanced Search" EXTENDS "Basic Search" (adds filters, sorting)
   - "Premium Features" EXTENDS "Core Features"

4. **RELATED_TO**: Conceptually related, part of same feature area, no direct dependency.
   - "Push Notifications" RELATED_TO "Email Notifications" (both are notification types)
   - "User Profile" RELATED_TO "User Settings" (both about user management)

RULES:
- Be AGGRESSIVE in finding connections - most capabilities should have at least one relationship
- Prefer specific types (DEPENDS_ON, ENABLES, EXTENDS) over generic (RELATED_TO)
- A capability can have MULTIPLE relationships
- Relationships are DIRECTIONAL (source → target)
- Don't create circular dependencies in DEPENDS_ON chains
- NEW capabilities should connect to existing ones where logical

Return valid JSON:
{
    "relationships": [
        {"source": "Capability Name", "target": "Other Capability Name", "type": "DEPENDS_ON"},
        {"source": "Another Capability", "target": "Capability Name", "type": "RELATED_TO"}
    ]
}"""

        # Format capabilities with full details for better analysis
        def format_capability(c: dict) -> str:
            title = c.get("title", c.get("name", "Unknown"))
            desc = c.get("description", "")[:150]
            is_new = "[NEW] " if title in new_titles else ""
            return f"{is_new}{title}: {desc}"
        
        capabilities_text = "\n".join([
            f"- {format_capability(c)}" for c in all_capabilities
        ])

        user_message = f"""Analyze these {len(all_capabilities)} capabilities and find ALL relationships between them.

CAPABILITIES:
{capabilities_text}

Find relationships where:
1. Between NEW capabilities (marked [NEW])
2. From NEW capabilities to existing ones
3. From existing capabilities to NEW ones

Be thorough - a well-connected Knowledge Graph is the goal. Each capability should ideally have at least one connection."""

        try:
            logger.info(f"AI analyzing relationships for {len(new_capabilities)} new + {len(existing_capabilities)} existing capabilities")
            
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            relationships = result.get("relationships", [])
            
            # Validate relationships - ensure source and target exist
            valid_titles = {c.get("title", c.get("name", "")) for c in all_capabilities}
            valid_relationships = []
            for rel in relationships:
                source = rel.get("source", "")
                target = rel.get("target", "")
                rel_type = rel.get("type", "RELATED_TO")
                
                if source in valid_titles and target in valid_titles and source != target:
                    # Normalize relationship type
                    if rel_type not in ["DEPENDS_ON", "ENABLES", "EXTENDS", "RELATED_TO"]:
                        rel_type = "RELATED_TO"
                    valid_relationships.append({
                        "source": source,
                        "target": target,
                        "type": rel_type
                    })
            
            logger.info(f"AI identified {len(valid_relationships)} valid relationships")
            return valid_relationships
            
        except Exception as e:
            logger.error(f"Relationship analysis error: {e}")
            return []


# Singleton instance
ai_service = AIService()
