from fastapi import APIRouter, Depends
from ..auth import get_current_user
from ..db import fetch_all

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("")
def list_roles(user=Depends(get_current_user)):
    return fetch_all("select * from app_roles order by name")


@router.get("/permissions")
def list_permissions(user=Depends(get_current_user)):
    return fetch_all("select * from app_permissions order by code")


@router.get("/{role_code}/permissions")
def role_permissions(role_code: str, user=Depends(get_current_user)):
    return fetch_all(
        """
        select p.*
        from app_roles r
        join app_role_permissions rp on rp.role_id = r.id
        join app_permissions p on p.id = rp.permission_id
        where r.code=%s
        order by p.code
        """,
        [role_code],
    )
