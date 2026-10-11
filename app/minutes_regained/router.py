from fastapi import APIRouter
from pydantic import BaseModel, Field

from . import dashboard, mock_crm, sessions
from .agent import run_turn
from .business_profile import BUSINESS

router = APIRouter(prefix="/mr", tags=["minutes-regained"])


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1, description="Caller-provided id for this conversation thread")


class AgentChatResponse(BaseModel):
    reply: str
    session_id: str


@router.get("/business")
def business_profile():
    return BUSINESS


@router.post("/chat", response_model=AgentChatResponse)
def chat(req: AgentChatRequest):
    history = sessions.get_history(req.session_id)
    reply, updated_history = run_turn(history, req.message)
    sessions.save_history(req.session_id, updated_history)
    return AgentChatResponse(reply=reply, session_id=req.session_id)


@router.get("/bookings")
def bookings():
    return mock_crm.list_bookings()


@router.get("/approvals")
def approvals(status: str | None = None):
    return mock_crm.list_approval_queue(status=status)


@router.get("/minutes-regained")
def minutes_regained():
    return dashboard.compute_stats()
