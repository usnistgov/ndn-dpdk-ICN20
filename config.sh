source env.sh

SRC_ROOT=$HOME/go/src/ndn-dpdk
CMD_YAMLEDIT='nodejs '$SRC_ROOT'/build/cmd/yamledit/'
CMD_MGMTCMD=$SRC_ROOT/build/mgmtcmd.sh
CMD_CREATEFACE='nodejs '$SRC_ROOT'/build/cmd/mgmtclient/create-face'
CMD_NDNFW=$(which ndnfw-dpdk)
CMD_NDNPING=$(which ndnping-dpdk)
CMD_MSIBENCH='nodejs '$SRC_ROOT'/build/cmd/benchmark/msibench'
CMD_NFDEMU='nodejs '$SRC_ROOT'/build/cmd/nfdemu/'

TOPO=single
NPATTERNS=6
INTERESTNAMELEN=4
DATASUFFIXLEN=0
PAYLOADLEN=1000

MSI_INTERVALMIN=500
MSI_INTERVALMAX=2500
MSI_UNCERTAINTY=10

if [[ -f config-override.sh ]]; then
  source config-override.sh
fi
