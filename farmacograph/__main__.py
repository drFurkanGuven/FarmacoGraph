"""python -m farmacograph entry point."""

from farmacograph.cli.main import app

if app is not None:
    app()
