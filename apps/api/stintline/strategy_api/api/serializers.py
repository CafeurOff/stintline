"""Request and response shapes of the strategy endpoints (explicit, for OpenAPI)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

COMPOUND_CHOICES = [(c, c) for c in ("SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET")]
NEUTRALISATION_CHOICES = [("SC", "SC"), ("VSC", "VSC")]
MAX_COMPARED_CARS = 4


class CarsQuerySerializer(serializers.Serializer[Any]):
    cars = serializers.CharField(
        help_text=f"Comma-separated car numbers (1 to {MAX_COMPARED_CARS}), e.g. `1,4`"
    )

    def validate_cars(self, value: str) -> list[int]:
        try:
            cars = sorted({int(v) for v in value.split(",") if v.strip()})
        except ValueError as exc:
            raise serializers.ValidationError("car numbers must be integers") from exc
        if not 1 <= len(cars) <= MAX_COMPARED_CARS:
            raise serializers.ValidationError(f"give between 1 and {MAX_COMPARED_CARS} cars")
        return cars


class OptionalCarsQuerySerializer(CarsQuerySerializer):
    cars = serializers.CharField(required=False, help_text="Optional car filter, e.g. `1,4`")


class CompareQuerySerializer(serializers.Serializer[Any]):
    a = serializers.IntegerField(min_value=1, max_value=99)
    b = serializers.IntegerField(min_value=1, max_value=99)


class LapSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    lap = serializers.IntegerField()
    time_s = serializers.FloatField(allow_null=True)
    corrected_time_s = serializers.FloatField(allow_null=True)
    compound = serializers.CharField()
    tyre_age = serializers.IntegerField(allow_null=True)
    stint = serializers.IntegerField(allow_null=True)
    is_pit_in = serializers.BooleanField()
    is_pit_out = serializers.BooleanField()
    race_time_s = serializers.FloatField(allow_null=True)
    excluded = serializers.CharField(allow_null=True, help_text="Exclusion reason, null if kept")


class CompoundDegradationSerializer(serializers.Serializer[Any]):
    compound = serializers.CharField()
    slope_s_per_lap = serializers.FloatField()
    slope_ci = serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    n_laps = serializers.IntegerField()
    n_stints = serializers.IntegerField()
    new_tyre_pace_s = serializers.FloatField()
    low_confidence = serializers.BooleanField()


class DegradationPointSerializer(serializers.Serializer[Any]):
    tyre_age = serializers.IntegerField()
    corrected_time_s = serializers.FloatField()


class StintFitSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    stint = serializers.IntegerField()
    compound = serializers.CharField()
    model = serializers.ChoiceField(choices=[("linear", "linear"), ("quadratic", "quadratic")])
    coefficients = serializers.ListField(child=serializers.FloatField())
    slope_s_per_lap = serializers.FloatField()
    slope_ci = serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    r_squared = serializers.FloatField()
    rmse_s = serializers.FloatField()
    n_laps = serializers.IntegerField()
    points = DegradationPointSerializer(many=True)


class FuelSerializer(serializers.Serializer[Any]):
    seconds_per_kg = serializers.FloatField()
    gain_per_lap_s = serializers.FloatField()


class DegradationSerializer(serializers.Serializer[Any]):
    compounds = CompoundDegradationSerializer(many=True)
    stints = StintFitSerializer(many=True)
    fuel = FuelSerializer()


class NeutralisedLossSerializer(serializers.Serializer[Any]):
    status = serializers.CharField()
    loss_s = serializers.FloatField()


class StopLossSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    lap = serializers.IntegerField()
    loss_s = serializers.FloatField()
    neutralisation = serializers.CharField(allow_null=True)
    outlier = serializers.BooleanField()


class PitLossSerializer(serializers.Serializer[Any]):
    green_s = serializers.FloatField()
    green_sigma_s = serializers.FloatField()
    n_green = serializers.IntegerField()
    neutralised = NeutralisedLossSerializer(many=True)
    assumed_sc_s = serializers.FloatField()
    assumed_vsc_s = serializers.FloatField()
    stops = StopLossSerializer(many=True)


class CompareLapSerializer(serializers.Serializer[Any]):
    lap = serializers.IntegerField()
    time_a_s = serializers.FloatField(allow_null=True)
    time_b_s = serializers.FloatField(allow_null=True)
    gap_s = serializers.FloatField(allow_null=True, help_text="B race time minus A (> 0: A ahead)")
    compound_a = serializers.CharField()
    compound_b = serializers.CharField()


class CompareSerializer(serializers.Serializer[Any]):
    car_a = serializers.IntegerField()
    car_b = serializers.IntegerField()
    laps = CompareLapSerializer(many=True)
    pace_offset_a_s = serializers.FloatField(allow_null=True)
    pace_offset_b_s = serializers.FloatField(allow_null=True)


class UndercutRequestSerializer(serializers.Serializer[Any]):
    attacker = serializers.IntegerField(
        min_value=1, max_value=99, help_text="Car behind, pitting first"
    )
    defender = serializers.IntegerField(min_value=1, max_value=99)
    stop_lap = serializers.IntegerField(min_value=2, help_text="Attacker's in-lap")
    attacker_compound = serializers.ChoiceField(choices=COMPOUND_CHOICES)
    defender_compound = serializers.ChoiceField(choices=COMPOUND_CHOICES)
    defender_reaction_laps = serializers.IntegerField(min_value=0, max_value=10, default=1)


class LapGapSerializer(serializers.Serializer[Any]):
    lap = serializers.IntegerField()
    gap_s = serializers.FloatField()


class UndercutResultSerializer(serializers.Serializer[Any]):
    gap_before_s = serializers.FloatField()
    gap_after_s = serializers.FloatField()
    net_gain_s = serializers.FloatField()
    sigma_s = serializers.FloatField()
    p_attacker_ahead = serializers.FloatField()
    attacker_ahead = serializers.BooleanField()
    lap_gaps = LapGapSerializer(many=True)


class RivalStopSerializer(serializers.Serializer[Any]):
    car = serializers.IntegerField(min_value=1, max_value=99)
    lap = serializers.IntegerField(min_value=1)


class PitExitRequestSerializer(serializers.Serializer[Any]):
    car = serializers.IntegerField(min_value=1, max_value=99)
    pit_lap = serializers.IntegerField(min_value=2)
    neutralisation = serializers.ChoiceField(
        choices=NEUTRALISATION_CHOICES, required=False, allow_null=True
    )
    rival_stops = serializers.ListField(child=RivalStopSerializer(), required=False, max_length=19)


class RivalOutcomeSerializer(serializers.Serializer[Any]):
    car = serializers.IntegerField()
    gap_s = serializers.FloatField()
    margin_s = serializers.FloatField()
    p_pitting_car_ahead = serializers.FloatField()


class PitExitResultSerializer(serializers.Serializer[Any]):
    car = serializers.IntegerField()
    pit_lap = serializers.IntegerField()
    pit_loss_s = serializers.FloatField()
    sigma_s = serializers.FloatField()
    position_before = serializers.IntegerField()
    expected_position = serializers.FloatField()
    most_likely_position = serializers.IntegerField()
    interval = serializers.ListField(child=serializers.IntegerField(), min_length=2, max_length=2)
    distribution = serializers.ListField(child=serializers.FloatField())
    rivals = RivalOutcomeSerializer(many=True)


class AssumptionSerializer(serializers.Serializer[Any]):
    group = serializers.CharField()
    name = serializers.CharField()
    value = serializers.CharField()
    description = serializers.CharField(allow_blank=True)


class ModelCardSerializer(serializers.Serializer[Any]):
    engine_version = serializers.CharField()
    assumptions = AssumptionSerializer(many=True)
    backtest = serializers.DictField(
        help_text="Backtest metrics per set (reference, held-out) and mode"
    )


class ReplayCarSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    line_times_s = serializers.ListField(
        child=serializers.FloatField(allow_null=True),
        help_text="Race time when the car completed each lap (index = lap - 1)",
    )
    compounds = serializers.ListField(child=serializers.CharField(allow_null=True))
    tyre_ages = serializers.ListField(child=serializers.IntegerField(allow_null=True))
    pit_in_laps = serializers.ListField(child=serializers.IntegerField())


class ReplaySerializer(serializers.Serializer[Any]):
    total_laps = serializers.IntegerField()
    cars = ReplayCarSerializer(many=True)
