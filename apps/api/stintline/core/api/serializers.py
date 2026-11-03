from rest_framework import serializers

COMPONENT_STATUS_CHOICES = [("ok", "ok"), ("unavailable", "unavailable")]


class HealthSerializer(serializers.Serializer[object]):
    status = serializers.ChoiceField(choices=COMPONENT_STATUS_CHOICES)
    version = serializers.CharField()
    database = serializers.ChoiceField(choices=COMPONENT_STATUS_CHOICES)


class ProblemSerializer(serializers.Serializer[object]):
    """Error body returned by every endpoint (inspired by RFC 9457 problem details)."""

    type = serializers.CharField()
    title = serializers.CharField()
    status = serializers.IntegerField()
    detail = serializers.CharField(allow_blank=True)
    code = serializers.CharField()
    invalid_params = serializers.DictField(required=False)
