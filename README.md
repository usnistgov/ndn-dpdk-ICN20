# NDN-DPDK Benchmark for ACM-ICN 2020 Paper

This repository contains [NDN-DPDK](https://github.com/usnistgov/ndn-dpdk) benchmark script used in the following paper:

* Junxiao Shi, Davide Pesavento, and Lotfi Benmohamed. 2020. [**NDN-DPDK: NDN Forwarding at 100 Gbps on Commodity Hardware**](https://www.nist.gov/publications/ndn-dpdk-ndn-forwarding-100-gbps-commodity-hardware). In Proceedings of the 7th ACM Conference on Information-Centric Networking (ICN '20). Association for Computing Machinery, New York, NY, USA, 30–40. DOI:<https://doi.org/10.1145/3405656.3418715>

This software is developed at the [Advanced Network Technologies Division](https://www.nist.gov/itl/antd) of the [National Institute of Standards and Technology](https://www.nist.gov/).
It is provided for reproducibility purpose and will not receive updates.

## Usage

The benchmark requires two machines, connected with three ports like this diagram:

```text
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

[NDN-DPDK paper](https://www.nist.gov/publications/ndn-dpdk-ndn-forwarding-100-gbps-commodity-hardware) has specific information on the hardware and operating system setup.

To run the benchmarks:

1. Clone this repository to `$HOME/benchmark`.

2. Clone [NDN-DPDK](https://github.com/usnistgov/ndn-dpdk) to `$HOME/go/src/ndn-dpdk` and checkout revision 34f561f4ef0e5790d4999107dcbb4c2eab82af66.
   Due to significant changes in NDN-DPDK codebase, the benchmark will not work with other NDN-DPDK versions.

3. Build and install NDN-DPDK.

4. Run `npm install`.

5. Copy `sample.env` to `.env`, and then enter the following in `.env`:

   * SSH host and JSON-RPC management endpoint of each machine.
   * PCI address and NUMA socket of each Ethernet adapter.

6. Run a benchmark script with `ts-node`. For example:

    ```bash
    ts-node ./batch-numa-fwds.ts
    ```

   If necessary, modify the script to adjust parameter ranges.

7. Results are stored in `output/` directory.
   If you want to rerun a benchmark scenario, you need to delete the result folder for that scenario, otherwise the scenario will be skipped.
