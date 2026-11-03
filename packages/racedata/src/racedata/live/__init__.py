"""Official live timing feed (SignalR Core), for the local live mode only (ADR 0002).

Unauthenticated topics only, personal use, never from a public deployment. The feed is a
snapshot followed by incremental updates merged into it (:mod:`racedata.live.merge`),
from which :mod:`racedata.live.snapshot` derives a provider-neutral live view.
"""
