from channels.routing import ProtocolTypeRouter


def test_asgi_application_routes_http_and_websocket() -> None:
    from config.asgi import application

    assert isinstance(application, ProtocolTypeRouter)
    assert set(application.application_mapping) == {"http", "websocket"}
