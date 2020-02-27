source env.sh

SRC_ROOT=$HOME/go/src/ndn-dpdk
CMD_YAMLEDIT=ndndpdk-yamledit
CMD_MGMTCMD=ndndpdk-mgmtcmd
CMD_CREATEFACE=ndndpdk-create-face
CMD_NDNFW=ndnfw-dpdk
CMD_TESTPMD=testpmd
CMD_NDNPING=ndnping-dpdk
CMD_MSIBENCH='nodejs '$SRC_ROOT'/build/cmd/benchmark/msibench'
CMD_FETCHBENCH='nodejs '$SRC_ROOT'/build/cmd/benchmark/fetchbench'

# override to bridge two ports with DPDK testpmd in place of forwarder
# example: FW_TESTPMD="$IF_FW0 $IF_FW1"
FW_TESTPMD=
# extra testpmd arguments
FW_TESTPMD_ARGS=

TOPO=single
GENMODE=msi # msi or fetch
NFETCHERS=4
NPATTERNS=6
INTERESTNAMELEN=4
DATASUFFIXLEN=0
PAYLOADLEN=1000

INTERVAL_INIT=2000
MSI_INTERVALMIN=500
MSI_INTERVALMAX=2500
MSI_INTERVALSTEP=1
MSI_UNCERTAINTY=10
MSI_HINTNEARBY=100

FETCH_SAMPLEINTERVAL=10
FETCH_SAMPLECOUNT=12000
FETCH_UNCERTAINTY=15000

if [[ -f config-override.sh ]]; then
  source config-override.sh
fi
