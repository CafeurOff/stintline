# Security policy

## Supported versions

StintLine has no versioned releases. Fixes land on `main`, and only `main` is supported.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub:
**Security → Report a vulnerability** on this repository
([private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)).

Include what is affected, how to reproduce it and its impact. You should get a first answer within a week. Once a fix is merged, the advisory is published with credit to the reporter, unless you prefer otherwise.

## Scope

In scope: the code in this repository, including the API, the web app, the ingestion and the deployment files in `infra/`.

Of particular interest:

- the two views that reach upstream services on request: the FIA PDF relay and the Wikipedia portrait relay (`apps/api/stintline/paddock/relay.py`, `apps/api/stintline/racing/portraits.py`), which must not become open proxies;
- the page heads rendered by the API (`apps/api/stintline/seo/`) and their Content-Security-Policy;
- the handling of third-party content: RSS feeds and FIA PDFs.

Out of scope: the third-party data sources themselves (OpenF1, Jolpica, fia.com, Open-Meteo, Wikimedia) and any deployment you run yourself.
