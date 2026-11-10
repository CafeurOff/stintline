"""Request and response shapes of the strategy endpoints (explicit, for OpenAPI)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.racing.api.serializers import DriverSerializer, TeamSerializer
from stintline.racing.models import SessionEntry, TelemetryLap
from stintline.strategy_api.telemetry import MAX_TELEMETRY_CARS

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


class PlannedStopSerializer(serializers.Serializer[Any]):
    lap = serializers.IntegerField(min_value=1, help_text="In-lap: new tyres from the next lap")
    compound = serializers.ChoiceField(choices=COMPOUND_CHOICES)


MAX_STOPS = 5
"""No race has needed more planned stops; more is a typing slip, not a strategy."""


class StrategyRequestSerializer(serializers.Serializer[Any]):
    car = serializers.IntegerField(min_value=1, max_value=99)
    start_compound = serializers.ChoiceField(choices=COMPOUND_CHOICES)
    stops = PlannedStopSerializer(many=True)

    def validate_stops(self, stops: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(stops) > MAX_STOPS:
            raise serializers.ValidationError(f"at most {MAX_STOPS} stops")
        laps = [stop["lap"] for stop in stops]
        if laps != sorted(set(laps)):
            raise serializers.ValidationError("stops must be on different laps, in order")
        return stops


class StrategyPlanSerializer(serializers.Serializer[Any]):
    start_compound = serializers.CharField()
    stops = PlannedStopSerializer(many=True)


class PositionChanceSerializer(serializers.Serializer[Any]):
    position = serializers.IntegerField()
    probability = serializers.FloatField()
    points = serializers.FloatField(help_text="Points scored at that position in this race")


class StrategyResultSerializer(serializers.Serializer[Any]):
    car = serializers.IntegerField()
    laps = serializers.IntegerField()
    real_strategy = StrategyPlanSerializer()
    strategy = StrategyPlanSerializer()
    line_times_s = serializers.ListField(
        child=serializers.FloatField(), help_text="Alternative race time at each line (lap - 1)"
    )
    compounds = serializers.ListField(child=serializers.CharField())
    tyre_ages = serializers.ListField(child=serializers.IntegerField())
    deltas_s = serializers.ListField(
        child=serializers.FloatField(), help_text="Cumulative gain (< 0) or loss per lap"
    )
    real_time_s = serializers.FloatField()
    final_time_s = serializers.FloatField()
    gain_s = serializers.FloatField(help_text="> 0: the alternative is faster")
    sigma_s = serializers.FloatField()
    real_position = serializers.IntegerField()
    position = serializers.IntegerField(help_text="Most likely finishing position")
    real_points = serializers.FloatField()
    points = serializers.FloatField(help_text="Points at the most likely position")
    chances = PositionChanceSerializer(many=True)
    warnings = serializers.ListField(child=serializers.CharField())


class TelemetryQuerySerializer(serializers.Serializer[Any]):
    cars = serializers.CharField(
        help_text="1 to 3 comma-separated car numbers; the first is the reference, e.g. `4,81`"
    )

    def validate_cars(self, value: str) -> list[int]:
        try:
            cars = [int(v) for v in value.split(",") if v.strip()]
        except ValueError as exc:
            raise serializers.ValidationError("car numbers must be integers") from exc
        cars = list(dict.fromkeys(cars))
        if not 1 <= len(cars) <= MAX_TELEMETRY_CARS:
            raise serializers.ValidationError(f"give between 1 and {MAX_TELEMETRY_CARS} cars")
        return cars


class TelemetryEntrySerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    team = TeamSerializer(read_only=True)

    class Meta:
        model = SessionEntry
        fields = ["car_number", "driver", "team", "team_colour"]


class TelemetryLapSerializer(serializers.ModelSerializer[TelemetryLap]):
    """A stored fastest lap, without its samples."""

    entry = TelemetryEntrySerializer(read_only=True)

    class Meta:
        model = TelemetryLap
        fields = ["entry", "lap_number", "lap_time_s"]


class BrakingZoneSerializer(serializers.Serializer[Any]):
    start_m = serializers.IntegerField()
    end_m = serializers.IntegerField()
    entry_kph = serializers.IntegerField()
    min_kph = serializers.IntegerField(help_text="Lowest speed before full throttle: the apex")
    x = serializers.FloatField()
    y = serializers.FloatField()


class TelemetryCarSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    entry = TelemetryEntrySerializer()
    lap_number = serializers.IntegerField()
    lap_time_s = serializers.FloatField()
    max_speed_kph = serializers.FloatField()
    full_throttle_share = serializers.FloatField()
    speed_kph = serializers.ListField(child=serializers.FloatField())
    throttle_pct = serializers.ListField(child=serializers.FloatField())
    brake = serializers.ListField(child=serializers.BooleanField())
    gear = serializers.ListField(child=serializers.IntegerField())
    drs_open = serializers.ListField(child=serializers.BooleanField())
    x = serializers.ListField(child=serializers.FloatField(), help_text="Screen units")
    y = serializers.ListField(child=serializers.FloatField())
    delta_s = serializers.ListField(
        child=serializers.FloatField(), help_text="Seconds behind the first car at each point"
    )
    braking_zones = BrakingZoneSerializer(many=True)


class TelemetryCompareSerializer(serializers.Serializer[Any]):
    width = serializers.IntegerField(help_text="Screen box of x and y, like the track drawing")
    height = serializers.IntegerField()
    length_m = serializers.IntegerField(help_text="Common lap length the laps are drawn on")
    step_m = serializers.FloatField(help_text="Distance between two points")
    points = serializers.IntegerField()
    cars = TelemetryCarSerializer(many=True)
