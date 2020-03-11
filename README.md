# NDN-DPDK benchmarks

The benchmark requires two machines, connected with three ports like this diagram.

```
-------------
| ndn-dpdk  |
| forwarder |
---v--v--v---
   |  |  |
---^--^--^---
| traffic   |
| generator |
-------------
```

Write configs in `.env` (reference `sample.env`), and invoke all scripts via `ts-node`.
