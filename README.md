# NDN-DPDK benchmarks

The benchmark requires two machines, connected like this diagram.
Write configs in `env.sh` and `init-config.yaml`, and invoke all scripts on traffic generator machine.

```
-------------
| ndn-dpdk  |
| forwarder |
---v-----v---
   |     |
---^-----^---
| traffic   |
| generator |
-------------
```

Available experiments:

* `one.sh`: benchmark once.
* `mtu.sh`: benchmark with varying payload length.
* `cscaps.sh`: benchmark with varying Content Store capacity.
* `catchunks.sh`: compare NFD and ndnfw-dpdk using *ndncatchunks*.
