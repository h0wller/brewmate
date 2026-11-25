# BrewMate T0/T1 isolated prototype

This directory is an experiment only. It is not imported by the application and makes no changes to BrewMate runtime behavior.

Run the dependency-free checks with:

```powershell
node --test experiments/adr-t0-t1-prototype/*.test-node.mjs
```

The recovery model is a deterministic fault-injection simulator, not an IndexedDB or browser implementation. Passing its tests validates protocol invariants only; browser quota, transaction, tab coordination, service-worker update, and eviction behavior still require a browser prototype.

The T0 helpers intentionally cover canonical JSON envelopes, conflict fingerprints, archive path policy, and bundle framing. No archive container is selected here.
