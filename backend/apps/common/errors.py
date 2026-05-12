from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    detail = response.data
    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        response.data = {"error": {"message": str(detail["detail"]), "code": response.status_code}}
    else:
        response.data = {"error": {"message": "Validation failed", "code": response.status_code, "fields": detail}}
    return response
