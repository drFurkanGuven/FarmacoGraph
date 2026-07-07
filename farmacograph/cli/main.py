"""CLI entry point."""

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

    @app.command("validate-ontology")
    def validate_ontology() -> None:
        """Validate ontology registry files load correctly."""
        from farmacograph.ontology import load_ontology_registry

        registry = load_ontology_registry()
        typer.echo(
            f"Ontology v{registry.version}: {len(registry.relationships)} relationships, "
            f"{len(registry.constraints)} constraints"
        )

    @app.command("validate-package")
    def validate_package_cmd(
        input: str = typer.Option(..., "--input", "-i", help="Drug publish package JSON file"),
    ) -> None:
        """Validate a curator drug publish package (dry-run, no Neo4j)."""
        from farmacograph.curator.drug_package import validate_package_file

        result = validate_package_file(input)
        if result.valid:
            typer.echo("✓ Package valid")
            raise typer.Exit(0)
        typer.echo("✗ Validation failed:")
        for issue in result.errors:
            cid = issue.constraint_id or issue.level
            typer.echo(f"  - [{cid}] {issue.message}")
        raise typer.Exit(1)

    @app.command("curriculum-stats")
    def curriculum_stats_cmd(
        module: str = typer.Option("cardiovascular", "--module", "-m"),
    ) -> None:
        """Show curation queue stats from curriculum.yaml."""
        from farmacograph.curator.drug_package import curriculum_stats, load_curriculum

        stats = curriculum_stats(load_curriculum())
        typer.echo(f"Module: {stats['module']}")
        typer.echo(f"Total slugs: {stats['total_slugs']}")
        typer.echo(f"By status: {stats['by_status']}")
else:
    app = None  # type: ignore[assignment]
