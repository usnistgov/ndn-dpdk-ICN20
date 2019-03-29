#!/bin/bash
ACT=$1

IF_CLI=86:00.0
IF_SVR=87:00.0
IF_DN=06:00.0
IF_UP=09:00.0

#IF_CLI=86:00.0
#IF_SVR=8a:00.0
#IF_DN=06:00.0
#IF_UP=06:00.0

function FACE_FROM_IF() {
  echo ether://$2@$(echo $1 | sed -e 's/[:.]/-/g'):0
}

REMOTE_CLI=$(FACE_FROM_IF $IF_CLI 01-00-5E-00-17-AA)
REMOTE_SVR=$(FACE_FROM_IF $IF_SVR 01-00-5E-00-17-AA)
REMOTE_DN=$(FACE_FROM_IF $IF_DN 01-00-5E-00-17-AA)
REMOTE_UP=$(FACE_FROM_IF $IF_UP 01-00-5E-00-17-AA)
LOCAL_CLI=$(FACE_FROM_IF $IF_CLI 02-00-00-00-00-01)
LOCAL_SVR=$(FACE_FROM_IF $IF_SVR 02-00-00-00-00-02)
LOCAL_DN=$(FACE_FROM_IF $IF_DN 02-00-00-00-00-03)
LOCAL_UP=$(FACE_FROM_IF $IF_UP 02-00-00-00-00-04)

#REMOTE_CLI=$(FACE_FROM_IF $IF_CLI 02-00-00-00-00-03)
#REMOTE_SVR=$(FACE_FROM_IF $IF_SVR 02-00-00-00-00-03)
#REMOTE_DN=$(FACE_FROM_IF $IF_DN 02-00-00-00-00-01)
#REMOTE_UP=$(FACE_FROM_IF $IF_UP 02-00-00-00-00-02)
#LOCAL_CLI=$(FACE_FROM_IF $IF_CLI 02-00-00-00-00-01)
#LOCAL_SVR=$(FACE_FROM_IF $IF_SVR 02-00-00-00-00-02)
#LOCAL_DN=$(FACE_FROM_IF $IF_DN 02-00-00-00-00-03)
#LOCAL_UP=$(FACE_FROM_IF $IF_UP 02-00-00-00-00-03)

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

CPU_CLI=17,18,19,20,21
MEM_CLI=0,2048
#CPU_CLI=0,1,2,3,4
#MEM_CLI=2048
CPU_SVR=12,13,14,15,16
MEM_SVR=0,2048
CPU_FW=0,1,2,3,4,5,6,7,8,9,10,11 #,17,18,19,20,21,22,23
MEM_FW=16384,0
#MEM_FW=131072,0

# sudo testpmd $(cd /usr/local/lib; ls librte_*.so | sed 's/^/-d /') --socket-mem 16384,16384 -l 0-23 -n 2 -w 05:00.0 -w 08:00.0 -- --rxq=2 --txq=2 -i

NAME_EXTRA=
#NAME_EXTRA=/ABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJ

CLI_TB_INTERVALMAX=3us
CLI_TB_INTERVALSTEP=1ns
CLI_INTERVAL=1500ns
SVR_PAYLOADLEN=1000

MGMTCMD=$HOME/go/src/ndn-dpdk/build/mgmtcmd.sh
MGMTPROXYCMD=$HOME/go/src/ndn-dpdk/build/mgmtproxy.sh
CREATEFACECMD='nodejs '$HOME'/go/src/ndn-dpdk/build/cmd/mgmtclient/create-face'

if [[ $ACT == 'setup' ]]; then
  sudo $HOME/spdk-*/scripts/setup.sh
  sudo mkdir -p /mnt/huge2M
  sudo mount -t hugetlbfs nodev /mnt/huge2M -o pagesize=2M
  sudo mkdir -p /mnt/huge1G
  sudo mount -t hugetlbfs nodev /mnt/huge1G -o pagesize=1G
  for NODE in node0 node1; do
    echo 0 | sudo tee /sys/devices/system/node/$NODE/hugepages/hugepages-2048kB/nr_hugepages
    echo 192 | sudo tee /sys/devices/system/node/$NODE/hugepages/hugepages-1048576kB/nr_hugepages
  done
  sudo modprobe ib_uverbs
  sudo $MGMTPROXYCMD start
elif [[ $ACT == 'client' ]]; then
  sudo $(which ndnping-dpdk) -l $CPU_CLI --socket-mem $MEM_CLI --file-prefix client -w $IF_CLI -- -initcfg @ndnping.init-config.yaml -cnt 1s -tasks='
---
- face:
    remote: '$REMOTE_CLI'
    local: '$LOCAL_CLI'
  client:
    patterns:
      - prefix: /U/A'$NAME_EXTRA'
      - prefix: /U/B'$NAME_EXTRA'
      - prefix: /U/C'$NAME_EXTRA'
      - prefix: /U/D'$NAME_EXTRA'
      - prefix: /U/E'$NAME_EXTRA'
      - prefix: /U/F'$NAME_EXTRA'
    interval: '$CLI_INTERVAL'
'
elif [[ $ACT == 'tb' ]]; then
  sudo LOG_ThroughputBenchmark=V $(which ndnping-dpdk) -l $CPU_CLI --socket-mem $MEM_CLI --file-prefix client -w $IF_CLI -- -initcfg @ndnping.init-config.yaml -cnt 0 -tasks='
---
- face:
    remote: '$REMOTE_CLI'
    local: '$LOCAL_CLI'
  client:
    patterns:
      - prefix: /U/A'$NAME_EXTRA'
      - prefix: /U/B'$NAME_EXTRA'
      - prefix: /U/C'$NAME_EXTRA'
      - prefix: /U/D'$NAME_EXTRA'
      - prefix: /U/E'$NAME_EXTRA'
      - prefix: /U/F'$NAME_EXTRA'
    interval: '$CLI_INTERVAL'
' -throughput-benchmark='
---
intervalmin: 0ns
intervalmax: '$CLI_TB_INTERVALMAX'
intervalstep: '$CLI_TB_INTERVALSTEP'

txcount: 24000000
txdurationmin: 15s
txdurationmax: 60s

warmuptime: 5s
cooldowntime: 2s
readcountersfreq: 100ms

satisfythreshold: 0.999
retestthreshold: 0.950
retestcount: 1
'
elif [[ $ACT == 'server' ]]; then
  sudo $(which ndnping-dpdk) -l $CPU_SVR --socket-mem $MEM_SVR --file-prefix server -w $IF_SVR -- -initcfg @ndnping.init-config.yaml -cnt 1s -tasks='
---
- face:
    remote: '$REMOTE_SVR'
    local: '$LOCAL_SVR'
  server:
    patterns:
      - prefix: /U/A
        payloadlen: '$SVR_PAYLOADLEN'
      - prefix: /U/B
        payloadlen: '$SVR_PAYLOADLEN'
      - prefix: /U/C
        payloadlen: '$SVR_PAYLOADLEN'
      - prefix: /U/D
        payloadlen: '$SVR_PAYLOADLEN'
      - prefix: /U/E
        payloadlen: '$SVR_PAYLOADLEN'
      - prefix: /U/F
        payloadlen: '$SVR_PAYLOADLEN'
    nack: true
'
elif [[ $ACT == 'pktcopy' ]]; then
  sudo $(which ndnpktcopy-dpdk) -l $CPU_FW --socket-mem $MEM_FW --file-prefix fw -w $IF_DN -w $IF_UP -- -cnt 1s -faces $FACE_DN,$FACE_UP -pair
elif [[ $ACT == 'fw' ]]; then
  sudo $(which ndnfw-dpdk) -l $CPU_FW --socket-mem $MEM_FW --file-prefix fw -w $IF_DN -w $IF_UP -- -initcfg @ndnfw.init-config.yaml
  #sudo gdb --args $(which ndnfw-dpdk) -l $CPU_FW --socket-mem $MEM_FW --file-prefix fw -w $IF_DN -w $IF_UP -- -initcfg @ndnfw.init-config.yaml #2>&1 | tee fw.log
elif [[ $ACT == 'init' ]]; then
  while ! $MGMTCMD version; do
    sleep 0.5
  done
  FACEID_DN=$($CREATEFACECMD $REMOTE_DN $LOCAL_DN)
  FACEID_UP=$($CREATEFACECMD $REMOTE_UP $LOCAL_UP)
  echo 'FACEID_DN='$FACEID_DN' FACEID_UP='$FACEID_UP
  ./demo.sh fib $FACEID_UP
elif [[ $ACT == 'face' ]]; then
  $MGMTCMD face create $REMOTE_DN $LOCAL_DN $REMOTE_UP $LOCAL_UP
elif [[ $ACT == 'fib' ]]; then
  NEXTHOP=$2
  $MGMTCMD fib insert /U/A $NEXTHOP
  $MGMTCMD fib insert /U/B $NEXTHOP
  $MGMTCMD fib insert /U/C $NEXTHOP
  $MGMTCMD fib insert /U/D $NEXTHOP
  $MGMTCMD fib insert /U/E $NEXTHOP
  $MGMTCMD fib insert /U/F $NEXTHOP
  $MGMTCMD ndt updaten /U/A 0
  $MGMTCMD ndt updaten /U/B 1
  $MGMTCMD ndt updaten /U/C 2
  $MGMTCMD ndt updaten /U/D 3
  $MGMTCMD ndt updaten /U/E 4
  $MGMTCMD ndt updaten /U/F 5
elif [[ $ACT == 'ndt1' ]]; then
  $MGMTCMD ndt updaten /U/A 7
  $MGMTCMD ndt updaten /U/B 8
  $MGMTCMD ndt updaten /U/C 9
  $MGMTCMD ndt updaten /U/D 10
  $MGMTCMD ndt updaten /U/E 11
  $MGMTCMD ndt updaten /U/F 12
elif [[ $ACT == 'ndt2' ]]; then
  $MGMTCMD ndt updaten /U/A 0
  $MGMTCMD ndt updaten /U/B 0
  $MGMTCMD ndt updaten /U/C 0
  $MGMTCMD ndt updaten /U/D 0
  $MGMTCMD ndt updaten /U/E 0
  $MGMTCMD ndt updaten /U/F 0
fi
