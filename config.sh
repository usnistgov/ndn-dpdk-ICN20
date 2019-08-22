source env.sh

SRC_ROOT=$HOME/go/src/ndn-dpdk
CMD_YAMLEDIT='nodejs '$SRC_ROOT'/build/cmd/yamledit/'
CMD_MGMTCMD=$SRC_ROOT/build/mgmtcmd.sh
CMD_CREATEFACE='nodejs '$SRC_ROOT'/build/cmd/mgmtclient/create-face'
CMD_NDNFW=$(which ndnfw-dpdk)
CMD_TESTPMD=$(which testpmd)
CMD_NDNPING=$(which ndnping-dpdk)
CMD_MSIBENCH='nodejs '$SRC_ROOT'/build/cmd/benchmark/msibench'
CMD_NFDEMU='nodejs '$SRC_ROOT'/build/cmd/nfdemu/'

# override to bridge two ports with DPDK testpmd in place of forwarder
# example: FW_TESTPMD="$IF_FW0 $IF_FW1"
FW_TESTPMD=
# extra testpmd arguments
FW_TESTPMD_ARGS=

TOPO=single
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

if [[ -f config-override.sh ]]; then
  source config-override.sh
fi
