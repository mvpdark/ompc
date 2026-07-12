from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.domain import get_domain, registry as domain_registry
from app.db.session import get_db
from app.domains import register_all_domains
from app.models.content import Content
# 知识库已迁移到 ZSCJ，本地不再统计
# from app.models.knowledge_base import KnowledgeBase
from app.models.publish_record import PublishRecord
from app.models.trend_content import TrendContent
from app.models.user import User
from app.schemas.workspace import (
    DependencyReport,
    DomainInfo,
    DomainSwitchRequest,
    ExportRequest,
    ExportResponse,
    ProviderConnectionCheckRequest,
    ProviderConnectionCheckResponse,
    ProviderKeyUpdateRequest,
    ProviderStatusItem,
    PublishRecordCreate,
    PublishRecordRead,
    WorkspaceContentItem,
)
from app.services.dependency_service import dependency_report
from app.services.workspace_service import (
    apply_provider_key_settings,
    approved_content_items,
    check_provider_connection,
    create_export_package,
    has_human_approved_review,
    list_publish_records,
    provider_status_items,
)

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    counts = {
        "users": 1,
        "contents": db.scalar(
            select(func.count(Content.id)).where(Content.user_id == current_user.id)
        ) or 0,
        "approved_contents": db.scalar(
            select(func.count(Content.id)).where(
                Content.status == "approved", Content.user_id == current_user.id
            )
        )
        or 0,
        "review_pending_contents": db.scalar(
            select(func.count(Content.id)).where(
                Content.status == "review_pending", Content.user_id == current_user.id
            )
        )
        or 0,
        "published_contents": db.scalar(
            select(func.count(Content.id)).where(
                Content.status == "published", Content.user_id == current_user.id
            )
        )
        or 0,
        "knowledge_items": 0,  # 知识库已迁移到 ZSCJ，本地不再统计
        "trend_items": db.scalar(select(func.count(TrendContent.id))) or 0,
        "publish_records": db.scalar(
            select(func.count(PublishRecord.id)).where(PublishRecord.user_id == current_user.id)
        ) or 0,
    }
    pipeline = [
        {"name": "Data", "status": "foundation"},
        {"name": "Knowledge Base", "status": "next"},
        {"name": "Content", "status": "planned"},
        {"name": "Review", "status": "planned"},
        {"name": "Publishing", "status": "human_approval_required"},
    ]
    return {"counts": counts, "pipeline": pipeline}


@router.get("/provider-status", response_model=list[ProviderStatusItem])
def get_provider_status(
    current_user: User = Depends(get_current_user),
) -> list[ProviderStatusItem]:
    return provider_status_items()


@router.get("/dependencies", response_model=DependencyReport)
def get_dependency_report(
    current_user: User = Depends(get_current_user),
) -> DependencyReport:
    return DependencyReport.model_validate(dependency_report())


@router.post("/provider-keys", response_model=list[ProviderStatusItem])
def update_provider_keys(
    payload: ProviderKeyUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> list[ProviderStatusItem]:
    _ = current_user
    return apply_provider_key_settings(payload)


@router.post("/provider-check", response_model=ProviderConnectionCheckResponse)
def check_provider(
    payload: ProviderConnectionCheckRequest,
    current_user: User = Depends(get_current_user),
) -> ProviderConnectionCheckResponse:
    _ = current_user
    return check_provider_connection(payload)


@router.get("/approved-content", response_model=list[WorkspaceContentItem])
def get_approved_content(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[WorkspaceContentItem]:
    return [
        WorkspaceContentItem(
            id=content.id,
            platform=content.platform,
            title=content.title,
            tags=content.tags,
            status=content.status,
        )
        for content in approved_content_items(db, limit=limit, user_id=current_user.id)
    ]


@router.post("/export", response_model=ExportResponse)
def export_workspace(
    payload: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExportResponse:
    return create_export_package(db=db, payload=payload, current_user=current_user)


@router.get("/publish-records", response_model=list[PublishRecordRead])
def get_publish_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    platform: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[PublishRecordRead]:
    return [
        PublishRecordRead.model_validate(record)
        for record in list_publish_records(db=db, platform=platform, limit=limit, user_id=current_user.id)
    ]


@router.post("/publish-record")
def create_publish_record(
    payload: PublishRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    content = db.get(Content, payload.content_id)
    if content is None or content.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到这条内容。",
        )
    if content.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="只有人工批准后的内容可以记录为已发布。",
        )

    if not has_human_approved_review(db, content.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="只有人工确认通过的内容可以记录为已发布。",
        )

    record = PublishRecord(
        content_id=payload.content_id,
        user_id=current_user.id,
        platform=payload.platform,
        external_url=payload.external_url,
        status="published",
    )
    db.add(record)
    content.status = "published"
    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败，请重试",
        )
    return {
        "id": record.id,
        "content_id": record.content_id,
        "platform": record.platform,
        "status": record.status,
    }


@router.get("/domains", response_model=list[DomainInfo])
def list_domains(
    current_user: User = Depends(get_current_user),
) -> list[DomainInfo]:
    register_all_domains(domain_registry)
    return [
        DomainInfo(key=key, label=domain_registry.get(key).label)
        for key in domain_registry.list_keys()
    ]


@router.get("/domain", response_model=DomainInfo)
def get_current_domain_info(
    current_user: User = Depends(get_current_user),
) -> DomainInfo:
    try:
        domain = get_domain(getattr(current_user, "domain_key", None))
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="尚未注册任何内容域，请先部署业务域插件。",
        )
    return DomainInfo(key=domain.key, label=domain.label)


@router.put("/domain", response_model=DomainInfo)
def switch_domain(
    payload: DomainSwitchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DomainInfo:
    register_all_domains(domain_registry)
    if payload.domain_key not in domain_registry.list_keys():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"未知内容域：{payload.domain_key}",
        )
    domain = domain_registry.get(payload.domain_key)
    current_user.domain_key = domain.key
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败，请重试",
        )
    return DomainInfo(key=domain.key, label=domain.label)
