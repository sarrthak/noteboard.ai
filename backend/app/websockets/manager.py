from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections grouped by ticket_id."""

    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, ticket_id: str):
        await websocket.accept()
        self.active_connections.setdefault(ticket_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, ticket_id: str):
        conns = self.active_connections.get(ticket_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.active_connections.pop(ticket_id, None)

    async def broadcast_to_ticket(self, ticket_id: str, message: dict):
        for ws in self.active_connections.get(ticket_id, []):
            await ws.send_json(message)


dev_ws_manager = ConnectionManager()
