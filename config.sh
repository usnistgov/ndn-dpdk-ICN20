source env.sh

REMOTE_CLI=01:00:5e:00:17:aa
REMOTE_SVR=01:00:5e:00:17:aa
REMOTE_DN=01:00:5e:00:17:aa
REMOTE_UP=01:00:5e:00:17:aa
LOCAL_CLI=02:00:00:00:00:01
LOCAL_SVR=02:00:00:00:00:02
LOCAL_DN=02:00:00:00:00:03
LOCAL_UP=02:00:00:00:00:04

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
TB_INTERVALMIN=500ns
TB_INTERVALMAX=2500ns
RUNTB_WARMUP=20

if [[ -f config-override.sh ]]; then
  source config-override.sh
fi
