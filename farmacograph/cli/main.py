"""CLI entry point — Typer application (skeleton)."""

try:
    import typer
except ImportError:
    typer = None  # type: ignore[assignment]

if typer is not None:
    app = typer.Typer(name="farmacograph", help="FarmacoGraph knowledge platform CLI")

    @app.command()
    def version() -> None:
        """Print package version."""
        from farmacograph.version import __version__

        typer.echo(f"farmacograph {__version__}")

    @app.command()
    def validate_ontology() -> None:
        """Validate ontology registry files load correctly."""
        from farmacograph.ontology import load_ontology_registry

        registry = load_ontology_registry()
        typer.echo(f"Ontology v{registry.version}: {len(registry.relationships)} relationships, "
                   f"{len(registry.constraints)} constraints")
else:
    app = None  # type: ignore[assignment]
