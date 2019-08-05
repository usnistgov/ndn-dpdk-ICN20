#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

function nfd_start() {
  local CSCAP=$1
  sudo infoedit -f /etc/ndn/nfd.conf -s tables.cs_max_packets -v $CSCAP
  sudo systemctl start nfd
}

function nfd_stop() {
  sudo systemctl stop nfd
}

function nfdemu_start() {
  local NWORKERS=$1

  cat init-config.yaml \
    | $CMD_YAMLEDIT -n mempool.ETHRX.capacity 524287 \
    | $CMD_YAMLEDIT -n mempool.ETHRX.cachesize 512 \
    | $CMD_YAMLEDIT -j face.enableeth false \
    | $CMD_YAMLEDIT -j face.enablesock true \
    | $CMD_YAMLEDIT -n face.socktxqpkts 1024 \
    | $CMD_YAMLEDIT -n face.socktxqframes 4096 \
    | $CMD_YAMLEDIT -n face.chanrxgframes 4096 \
  > runtime/fw.init-config.yaml

  sudo $CMD_NDNFW -l $CPU_FW --socket-mem $MEM_FW --file-prefix fw -- -initcfg @runtime/fw.init-config.yaml &>runtime/fw.log &

  while ! $CMD_MGMTCMD version &>runtime/version.txt; do
    sleep 0.5
  done

  $CMD_NFDEMU -v -w $NWORKERS &>runtime/nfdemu.log &
}

function nfdemu_stop() {
  process_stop cmd/nfdemu
  fw_stop
}

PUTCHUNKS_MB=256
PUTCHUNKS_INPUT=/tmp/putchunks-input.bin
if ! [[ -f $PUTCHUNKS_INPUT ]]; then
  dd if=/dev/urandom of=$PUTCHUNKS_INPUT bs=1M count=$PUTCHUNKS_MB status=progress
fi
PREFIX1=/P$RANDOM

function putchunks_start() {
  local NAME=$1
  local FWD_ID=$2

  PREFIX=$PREFIX1/$NAME/%FD%01
  ndnputchunks $PREFIX <$PUTCHUNKS_INPUT &>runtime/putchunks-$NAME.log &

  if [[ $ACT == nfdemu-* ]]; then
    $CMD_MGMTCMD ndt updaten $PREFIX $FWD_ID >/dev/null
  fi
}

function putchunks_waitready() {
  local NAME=$1
  while ! grep 'Data published with name:' runtime/putchunks-$NAME.log >/dev/null; do
    sleep 0.5
  done
}

function putchunks_stopall() {
  process_stop ndnputchunks
}

function catchunks_start() {
  local NAME=$1
  local COND=$2
  PREFIX=$PREFIX1/$NAME/%FD%01
  ndncatchunks $PREFIX >/dev/null 2>runtime/catchunks-$COND-$NAME.log &
}

function catchunks_waitall() {
  while pgrep ndncatchunks >/dev/null; do
    sleep 0.5
  done
}

rm -rf runtime
mkdir -p runtime output

ACT=$1
case $ACT in
stop)
  nfd_stop
  nfdemu_stop
  exit 0
  ;;
nfd-small)
  nfd_start 65536
  export NDN_CLIENT_TRANSPORT=unix:///run/nfd.sock
  ;;
nfd-large)
  nfd_start 262144
  export NDN_CLIENT_TRANSPORT=unix:///run/nfd.sock
  ;;
nfdemu-6)
  nfdemu_start 6
  export NDN_CLIENT_TRANSPORT=unix:///tmp/nfdemu.sock
  ;;
nfdemu-1)
  nfdemu_start 1
  export NDN_CLIENT_TRANSPORT=unix:///tmp/nfdemu.sock
  ;;
*)
  echo 'bad action '$ACT >/dev/stderr
  exit 2
  ;;
esac

sleep 1

FWD_ID=0
for NAME in A B C D E F; do
  putchunks_start $NAME $FWD_ID
  FWD_ID=$((FWD_ID+1))
done
for NAME in A B C D E F; do
  putchunks_waitready $NAME
done
for NAME in A B C D E F; do
  catchunks_start $NAME PROD
done
catchunks_waitall
sleep 1
for NAME in A B C D E F; do
  catchunks_start $NAME CACHE
done
catchunks_waitall
putchunks_stopall

case $ACT in
nfd-*)
  nfd_stop
  ;;
nfdemu-*)
  nfdemu_stop
  ;;
esac

pushd runtime >/dev/null; tar cJf ../output/$ACT-$(date -u +%s).txz *; popd >/dev/null
