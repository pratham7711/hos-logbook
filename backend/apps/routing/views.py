from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .ors_client import get_client


@api_view(["POST"])
def geocode_view(request):
    text = (request.data or {}).get("text", "").strip()
    if not text:
        return Response({"error": "text is required"}, status=status.HTTP_400_BAD_REQUEST)
    client = get_client()
    try:
        result = client.geocode(text)
    except Exception as e:  # noqa: BLE001
        return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
    return Response({"label": result.label, "lat": result.lat, "lng": result.lng})
