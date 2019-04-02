source config-option.sh

function FACE_FROM_IF() {
  echo ether://$2@$(echo $1 | sed -e 's/[:.]/-/g'):0
}

if [[ $CFG_TOPO == 'twoport' ]]; then
  IF_CLI=86:00.0
  IF_SVR=87:00.0
  IF_DN=06:00.0
  IF_UP=09:00.0

  REMOTE_CLI=$(FACE_FROM_IF $IF_CLI 01-00-5E-00-17-AA)
  REMOTE_SVR=$(FACE_FROM_IF $IF_SVR 01-00-5E-00-17-AA)
  REMOTE_DN=$(FACE_FROM_IF $IF_DN 01-00-5E-00-17-AA)
  REMOTE_UP=$(FACE_FROM_IF $IF_UP 01-00-5E-00-17-AA)
  LOCAL_CLI=$(FACE_FROM_IF $IF_CLI 02-00-00-00-00-01)
  LOCAL_SVR=$(FACE_FROM_IF $IF_SVR 02-00-00-00-00-02)
  LOCAL_DN=$(FACE_FROM_IF $IF_DN 02-00-00-00-00-03)
  LOCAL_UP=$(FACE_FROM_IF $IF_UP 02-00-00-00-00-04)
elif [[ $CFG_TOPO == 'oneport' ]]; then
  IF_CLI=86:00.0
  IF_SVR=8a:00.0
  IF_DN=06:00.0
  IF_UP=06:00.0

  REMOTE_CLI=$(FACE_FROM_IF $IF_CLI 02-00-00-00-00-03)
  REMOTE_SVR=$(FACE_FROM_IF $IF_SVR 02-00-00-00-00-03)
  REMOTE_DN=$(FACE_FROM_IF $IF_DN 02-00-00-00-00-01)
  REMOTE_UP=$(FACE_FROM_IF $IF_UP 02-00-00-00-00-02)
  LOCAL_CLI=$(FACE_FROM_IF $IF_CLI 02-00-00-00-00-01)
  LOCAL_SVR=$(FACE_FROM_IF $IF_SVR 02-00-00-00-00-02)
  LOCAL_DN=$(FACE_FROM_IF $IF_DN 02-00-00-00-00-03)
  LOCAL_UP=$(FACE_FROM_IF $IF_UP 02-00-00-00-00-03)
fi

function NETDEV_FROM_IF() {
  local NETDEV
  NETDEV=$(echo $1 | cut -d: -f1 | awk --non-decimal-data '{ printf("enp%ds0", "0x" $1) }')
  if ! ip link show $NETDEV &>/dev/null; then
    NETDEV=$NETDEV'f'$(echo $1 | cut -d. -f2)
  fi
  echo $NETDEV
}

NETDEV_CLI=$(NETDEV_FROM_IF $IF_CLI)
NETDEV_SVR=$(NETDEV_FROM_IF $IF_SVR)
NETDEV_DN=$(NETDEV_FROM_IF $IF_DN)
NETDEV_UP=$(NETDEV_FROM_IF $IF_UP)

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

PREFIXES='/U/A /U/B /U/C /U/D /U/E /U/F'
FW_NFWS=6
CLI_INTERVAL=10us
RUNTB_WARMUP=20

if [[ -f config-override.sh ]]; then
  source config-override.sh
fi
