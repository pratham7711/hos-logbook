from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Trip
from .serializers import TripCreateSerializer, TripDetailSerializer, TripListSerializer
from .services.plan_trip_service import create_and_plan_trip


class TripViewSet(viewsets.GenericViewSet):
    queryset = Trip.objects.all()

    def get_serializer_class(self):
        if self.action == "list":
            return TripListSerializer
        if self.action == "create":
            return TripCreateSerializer
        return TripDetailSerializer

    def list(self, request):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        ser = TripListSerializer(page, many=True)
        return self.get_paginated_response(ser.data)

    def retrieve(self, request, pk=None):
        trip = self.get_queryset().filter(pk=pk).first()
        if not trip:
            return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(TripDetailSerializer(trip).data)

    def create(self, request):
        ser = TripCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            trip = create_and_plan_trip(ser.validated_data)
        except Exception as e:  # noqa: BLE001
            return Response({"error": str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(TripDetailSerializer(trip).data, status=status.HTTP_201_CREATED)
