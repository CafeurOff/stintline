from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.racing.api.serializers import CircuitSerializer, DriverSerializer, TeamSerializer

# ------------------------------------------------------------------------------ queries


class SeasonQuerySerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField(min_value=1950, max_value=2100)


class HeadToHeadQuerySerializer(SeasonQuerySerializer):
    a = serializers.SlugField(help_text="Driver ref (Jolpica driverId), e.g. `norris`")
    b = serializers.SlugField(help_text="Driver ref, e.g. `piastri`")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        if attrs["a"] == attrs["b"]:
            raise serializers.ValidationError("Pick two different drivers.")
        return attrs


class PaceQuerySerializer(serializers.Serializer[Any]):
    fuel = serializers.BooleanField(default=True, help_text="Fuel-corrected lap times")
    pit = serializers.BooleanField(default=False, help_text="Keep in-laps and out-laps")
    sc = serializers.BooleanField(
        default=False, help_text="Keep laps under SC, VSC or red flag and restart laps"
    )
    cutoff = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
        max_value=200,
        default=107,
        help_text="Drop laps slower than this % of the fastest lap (100-200); 0 keeps all",
    )

    def validate_cutoff(self, value: int | None) -> int | None:
        if not value:
            return None
        if value < 100:
            raise serializers.ValidationError("Use 0 (no cut-off) or 100 to 200.")
        return value


# ---------------------------------------------------------------------------- duels


class SideTotalsSerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    team = TeamSerializer()
    colour = serializers.CharField(allow_null=True)
    starts = serializers.IntegerField()
    points = serializers.FloatField()
    wins = serializers.IntegerField()
    podiums = serializers.IntegerField()
    poles = serializers.IntegerField(help_text="Qualifying first (grid first before 1994)")
    finishes = serializers.IntegerField()
    retirements = serializers.IntegerField()
    best_finish = serializers.IntegerField(allow_null=True)
    average_quali = serializers.FloatField(allow_null=True)
    average_finish = serializers.FloatField(allow_null=True)
    laps_led = serializers.IntegerField(allow_null=True, help_text="Timed seasons only (2023+)")


class SideRoundSerializer(serializers.Serializer[Any]):
    quali = serializers.IntegerField(allow_null=True)
    finish = serializers.IntegerField(allow_null=True)
    classification = serializers.CharField()
    status = serializers.CharField()
    points = serializers.FloatField()
    team_ref = serializers.CharField()


class DuelRoundSerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField()
    event_id = serializers.IntegerField()
    name = serializers.CharField()
    country = serializers.CharField()
    session_id = serializers.IntegerField(allow_null=True, help_text="Timed race, if any")
    a = SideRoundSerializer()
    b = SideRoundSerializer()
    quali_gap_s = serializers.FloatField(
        allow_null=True, help_text="A minus B in the last segment both set a time in"
    )
    pace_gap_s = serializers.FloatField(
        allow_null=True,
        help_text="A minus B: median fuel-corrected clean lap (negative = A faster)",
    )


class DuelSerializer(serializers.Serializer[Any]):
    a = SideTotalsSerializer()
    b = SideTotalsSerializer()
    shared_rounds = serializers.IntegerField()
    quali = serializers.ListField(child=serializers.IntegerField(), help_text="[A ahead, B ahead]")
    race = serializers.ListField(child=serializers.IntegerField())
    pace = serializers.ListField(child=serializers.IntegerField())
    median_quali_gap_s = serializers.FloatField(allow_null=True)
    median_pace_gap_s = serializers.FloatField(allow_null=True)
    rounds = DuelRoundSerializer(many=True)


class HeadToHeadSerializer(DuelSerializer):
    season = serializers.IntegerField()


class TeammatesSerializer(DuelSerializer):
    team = TeamSerializer()
    colour = serializers.CharField(allow_null=True)


# ----------------------------------------------------------------------------- pace


class PaceSummarySerializer(serializers.Serializer[Any]):
    n = serializers.IntegerField()
    median_s = serializers.FloatField()
    q1_s = serializers.FloatField()
    q3_s = serializers.FloatField()
    low_s = serializers.FloatField()
    high_s = serializers.FloatField()
    mean_s = serializers.FloatField()
    std_s = serializers.FloatField()
    outliers_s = serializers.ListField(child=serializers.FloatField())


class PaceLapSerializer(serializers.Serializer[Any]):
    lap = serializers.IntegerField()
    time_s = serializers.FloatField()
    value_s = serializers.FloatField(help_text="Raw or fuel-corrected, as requested")
    compound = serializers.CharField()
    tyre_age = serializers.IntegerField(allow_null=True)
    kept = serializers.BooleanField()


class PaceEntrySerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    team = TeamSerializer()
    team_colour = serializers.CharField()


class PaceCarSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    entry = PaceEntrySerializer()
    summary = PaceSummarySerializer(allow_null=True)
    laps = PaceLapSerializer(many=True)


class FastestLapSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    lap = serializers.IntegerField()
    time_s = serializers.FloatField()
    compound = serializers.CharField()
    tyre_age = serializers.IntegerField(allow_null=True)


class SessionPaceSerializer(serializers.Serializer[Any]):
    session_id = serializers.IntegerField()
    total_laps = serializers.IntegerField()
    fuel_corrected = serializers.BooleanField()
    fuel_gain_per_lap_s = serializers.FloatField()
    cutoff_pct = serializers.FloatField(allow_null=True)
    include_pit_laps = serializers.BooleanField()
    include_neutralised = serializers.BooleanField()
    cars = PaceCarSerializer(many=True)
    fastest_laps = FastestLapSerializer(many=True)


# ---------------------------------------------------------------------- consistency


class RaceRefSerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField()
    event_id = serializers.IntegerField()
    session_id = serializers.IntegerField()
    name = serializers.CharField()
    country = serializers.CharField()


class SpreadRaceSerializer(RaceRefSerializer):
    spread_s = serializers.FloatField(allow_null=True)


class ConsistencyRaceSerializer(SpreadRaceSerializer):
    clean_laps = serializers.IntegerField()


class ConsistencySerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    team = TeamSerializer()
    colour = serializers.CharField(allow_null=True)
    median_spread_s = serializers.FloatField()
    best = SpreadRaceSerializer()
    worst = SpreadRaceSerializer()
    races = ConsistencyRaceSerializer(many=True)


# ------------------------------------------------------------------------ pit stops


class StopSerializer(RaceRefSerializer):
    driver = DriverSerializer()
    team = TeamSerializer()
    colour = serializers.CharField(allow_null=True)
    lap = serializers.IntegerField()
    stationary_s = serializers.FloatField(allow_null=True)
    lane_s = serializers.FloatField(allow_null=True)


class TeamStopsSerializer(serializers.Serializer[Any]):
    team = TeamSerializer()
    colour = serializers.CharField(allow_null=True)
    stops = serializers.IntegerField()
    median_stationary_s = serializers.FloatField(allow_null=True)
    best_stationary_s = serializers.FloatField(allow_null=True)
    median_lane_s = serializers.FloatField(allow_null=True)
    best_lane_s = serializers.FloatField(allow_null=True)


class RaceStopsSerializer(RaceRefSerializer):
    stops = serializers.IntegerField()
    median_stationary_s = serializers.FloatField(allow_null=True)
    median_lane_s = serializers.FloatField(allow_null=True)
    fastest = StopSerializer(allow_null=True)
    pit_loss_s = serializers.FloatField(allow_null=True)
    pit_loss_sigma_s = serializers.FloatField(allow_null=True)
    pit_loss_reliable = serializers.BooleanField(
        help_text="Enough dry green-flag stops with a tight spread to stand for the circuit"
    )
    undercut_attempts = serializers.IntegerField()
    undercut_successes = serializers.IntegerField()


class PitStopsSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    stops = serializers.IntegerField()
    timed_stops = serializers.IntegerField(help_text="Stops with a stationary time")
    undercut_attempts = serializers.IntegerField()
    undercut_successes = serializers.IntegerField()
    fastest = StopSerializer(many=True)
    teams = TeamStopsSerializer(many=True)
    races = RaceStopsSerializer(many=True)


# ------------------------------------------------------------------------- circuits


class WinningStopsSerializer(serializers.Serializer[Any]):
    stops = serializers.IntegerField()
    races = serializers.IntegerField()


class DryCompoundSlopesSerializer(serializers.Serializer[Any]):
    SOFT = serializers.FloatField(allow_null=True)
    MEDIUM = serializers.FloatField(allow_null=True)
    HARD = serializers.FloatField(allow_null=True)


class CircuitRaceSerializer(serializers.Serializer[Any]):
    year = serializers.IntegerField()
    event_id = serializers.IntegerField()
    session_id = serializers.IntegerField()
    name = serializers.CharField()
    winner = DriverSerializer(allow_null=True)
    winner_team = TeamSerializer(allow_null=True)
    winner_colour = serializers.CharField(allow_null=True)
    winner_strategy = serializers.ListField(child=serializers.CharField())
    wet = serializers.BooleanField()
    passes = serializers.IntegerField(allow_null=True)
    safety_cars = serializers.IntegerField()
    virtual_safety_cars = serializers.IntegerField()
    red_flags = serializers.IntegerField()
    pit_loss_s = serializers.FloatField(allow_null=True)
    pit_loss_reliable = serializers.BooleanField()
    fastest_lap_s = serializers.FloatField(allow_null=True)
    undercut_attempts = serializers.IntegerField()
    undercut_successes = serializers.IntegerField()


class CircuitProfileSerializer(serializers.Serializer[Any]):
    circuit = CircuitSerializer()
    races = serializers.IntegerField()
    latest_event_id = serializers.IntegerField()
    latest_session_id = serializers.IntegerField()
    lap_length_m = serializers.FloatField(allow_null=True)
    top_speed_kph = serializers.FloatField(allow_null=True)
    full_throttle_share = serializers.FloatField(allow_null=True)
    braking_zones = serializers.IntegerField(allow_null=True)
    pit_loss_s = serializers.FloatField(
        allow_null=True, help_text="Median over the races whose pit loss is reliable"
    )
    pit_loss_sigma_s = serializers.FloatField(allow_null=True)
    degradation_s_per_lap = serializers.FloatField(
        allow_null=True, help_text="Median over dry races of the mean dry-compound slope"
    )
    degradation = DryCompoundSlopesSerializer()
    safety_car_races = serializers.IntegerField()
    vsc_races = serializers.IntegerField()
    wet_races = serializers.IntegerField()
    passes_per_race = serializers.FloatField(allow_null=True)
    undercut_attempts = serializers.IntegerField()
    undercut_successes = serializers.IntegerField()
    winning_stops = WinningStopsSerializer(many=True)
    fastest_lap_s = serializers.FloatField(allow_null=True)
    fastest_lap_year = serializers.IntegerField(allow_null=True)
    history = CircuitRaceSerializer(many=True)
