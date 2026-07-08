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

    @app.command("next-drugs")
    def next_drugs_cmd(
        limit: int = typer.Option(10, "--limit", "-n"),
    ) -> None:
        """List next pending drugs in the curation queue."""
        from farmacograph.curator.drug_package import list_pending_drugs

        for row in list_pending_drugs(limit=limit):
            pkg = "ready" if row["package_exists"] else "missing JSON"
            typer.echo(f"{row['slug']:22}  {row['category']:28}  ({pkg})")

    @app.command("init-drug-entry")
    def init_drug_entry_cmd(
        slug: str = typer.Option(..., "--slug", "-s"),
        overwrite: bool = typer.Option(False, "--overwrite"),
    ) -> None:
        """Create staging/cardiovascular/drugs/{slug}.json skeleton."""
        from farmacograph.curator.drug_package import init_drug_entry

        path = init_drug_entry(slug, overwrite=overwrite)
        typer.echo(f"Created {path}")

    @app.command("mark-published")
    def mark_published_cmd(
        slug: str = typer.Option(..., "--slug", "-s"),
    ) -> None:
        """Mark a slug as published in curriculum.yaml."""
        from farmacograph.curator.drug_package import mark_curriculum_published

        if mark_curriculum_published(slug):
            typer.echo(f"✓ {slug} → published in curriculum.yaml")
        else:
            typer.echo(f"No change for {slug} (not found or already published)")
            raise typer.Exit(1)
else:
    app = None  # type: ignore[assignment]
