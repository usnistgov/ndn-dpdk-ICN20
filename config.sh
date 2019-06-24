source config-option.sh

if [[ $CFG_TOPO == 'twoport' ]]; then
  IF_CLI=86:00.0
  IF_SVR=87:00.0
  IF_DN=06:00.0
  IF_UP=09:00.0

  REMOTE_CLI=01:00:5e:00:17:aa
  REMOTE_SVR=01:00:5e:00:17:aa
  REMOTE_DN=01:00:5e:00:17:aa
  REMOTE_UP=01:00:5e:00:17:aa
  LOCAL_CLI=02:00:00:00:00:01
  LOCAL_SVR=02:00:00:00:00:02
  LOCAL_DN=02:00:00:00:00:03
  LOCAL_UP=02:00:00:00:00:04
elif [[ $CFG_TOPO == 'oneport' ]]; then
  IF_CLI=86:00.0
  IF_SVR=8a:00.0
  IF_DN=06:00.0
  IF_UP=06:00.0

  REMOTE_CLI=02:00:00:00:00:03
  REMOTE_SVR=02:00:00:00:00:03
  REMOTE_DN=02:00:00:00:00:01
  REMOTE_UP=02:00:00:00:00:02
  LOCAL_CLI=02:00:00:00:00:01
  LOCAL_SVR=02:00:00:00:00:02
  LOCAL_DN=02:00:00:00:00:03
  LOCAL_UP=02:00:00:00:00:03
fi

HUGE1G_NPAGES=192
CPU_CLI=17,18,19,20,21
MEM_CLI=0,2048
CPU_SVR=12,13,14,15,16
MEM_SVR=0,2048
CPU_FW=0,1,2,3,4,5,6,7,8,9,10,11
MEM_FW=16384,0

SRC_ROOT=$HOME/go/src/ndn-dpdk
CMD_YAMLEDIT='nodejs '$SRC_ROOT'/build/cmd/yamledit/'
CMD_MGMTCMD=$SRC_ROOT/build/mgmtcmd.sh
CMD_MGMTPROXY=$SRC_ROOT/build/mgmtproxy.sh
CMD_CREATEFACE='nodejs '$SRC_ROOT'/build/cmd/mgmtclient/create-face'
CMD_NDNFW=$(which ndnfw-dpdk)
CMD_NDNPING=$(which ndnping-dpdk)
CMD_NFDEMU='nodejs '$SRC_ROOT'/build/cmd/nfdemu/'

PREFIXES='/U/A /U/B /U/C /U/D /U/E /U/F'
FW_NFWS=6
CLI_INTERVAL=10us
RUNTB_WARMUP=20

if [[ -f config-override.sh ]]; then
  source config-override.sh
fi
