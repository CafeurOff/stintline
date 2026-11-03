"""factory_boy factories for the racing models."""

from __future__ import annotations

import datetime as dt

import factory.django
from factory.declarations import Sequence, SubFactory

from stintline.racing import models


class SeasonFactory(factory.django.DjangoModelFactory[models.Season]):
    class Meta:
        model = models.Season
        django_get_or_create = ("year",)

    year = 2025


class CircuitFactory(factory.django.DjangoModelFactory[models.Circuit]):
    class Meta:
        model = models.Circuit
        django_get_or_create = ("ref",)

    ref = Sequence(lambda n: f"circuit-{n}")
    name = Sequence(lambda n: f"Circuit {n}")
    locality = "Somewhere"
    country = "Nowhere"


class EventFactory(factory.django.DjangoModelFactory[models.Event]):
    class Meta:
        model = models.Event

    season = SubFactory(SeasonFactory)
    round = Sequence(lambda n: n + 1)
    name = Sequence(lambda n: f"Test Grand Prix {n}")
    circuit = SubFactory(CircuitFactory)
    race_date = dt.date(2025, 6, 1)
    format = models.EventFormat.CONVENTIONAL


class SessionFactory(factory.django.DjangoModelFactory[models.Session]):
    class Meta:
        model = models.Session

    event = SubFactory(EventFactory)
    kind = models.SessionKind.RACE
    scheduled_start = dt.datetime(2025, 6, 1, 13, tzinfo=dt.UTC)
    starts_at = dt.datetime(2025, 6, 1, 13, tzinfo=dt.UTC)
    ends_at = dt.datetime(2025, 6, 1, 15, tzinfo=dt.UTC)
    openf1_session_key = Sequence(lambda n: 50_000 + n)


class TeamFactory(factory.django.DjangoModelFactory[models.Team]):
    class Meta:
        model = models.Team
        django_get_or_create = ("ref",)

    ref = Sequence(lambda n: f"team-{n}")
    name = Sequence(lambda n: f"Team {n}")


class DriverFactory(factory.django.DjangoModelFactory[models.Driver]):
    class Meta:
        model = models.Driver
        django_get_or_create = ("ref",)

    ref = Sequence(lambda n: f"driver-{n}")
    code = "TST"
    given_name = "Test"
    family_name = Sequence(lambda n: f"Driver{n}")


class SessionEntryFactory(factory.django.DjangoModelFactory[models.SessionEntry]):
    class Meta:
        model = models.SessionEntry

    session = SubFactory(SessionFactory)
    driver = SubFactory(DriverFactory)
    team = SubFactory(TeamFactory)
    car_number = Sequence(lambda n: n + 2)
