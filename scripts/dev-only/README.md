# Deprecated — development & bootstrap only

> **Official workflow:** [Curation Studio](../../apps/studio) (`apps/studio`)  
> Curators must not edit JSON manually in production.

These scripts remain for **pipeline testing**, **CI**, and **emergency recovery** only.

| Script | Purpose |
|--------|---------|
| `publish-stub.sh` | One-time structural stub → Neo4j via curator API |
| `publish-drug.sh` | Publish a local JSON package (legacy bootstrap) |
| `bootstrap-cv.sh` | Stub + curriculum queue summary |

```bash
# Example (local API)
FG_API_URL=http://127.0.0.1:8001 ./scripts/dev-only/publish-stub.sh
```

`staging/` JSON files are **internal fixtures**, not the authoring interface.
