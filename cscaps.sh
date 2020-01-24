#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh
mkdir -p output

MEM_FW=131072,0
CLI_INTERVAL=1us

while read -r -a ROW; do
  if ! [[ ${ROW[0]} =~ [0-9]+ ]]; then continue; fi
  KEY=$(echo "${ROW[*]}" | tr ' ' '-')
  if [[ -f output/cscaps-$KEY.txz ]]; then continue; fi

  rm -f runtime/*
  cat init-config.yaml \
    | $CMD_YAMLEDIT -n Fwdp.PcctCapacity ${ROW[0]} \
    | $CMD_YAMLEDIT -n Fwdp.CsCapMd ${ROW[1]} \
    | $CMD_YAMLEDIT -n Fwdp.CsCapMi ${ROW[2]} \
    | $CMD_YAMLEDIT -n Mempool.IND.Capacity 67108863 \
    | $CMD_YAMLEDIT -n Mempool.IND.CacheSize 512 \
    | $CMD_YAMLEDIT -n Mempool.ETHRX.Capacity 16777215 \
    | $CMD_YAMLEDIT -n Mempool.ETHRX.CacheSize 455 \
    | $CMD_YAMLEDIT -n Mempool.ETHRX.DataroomSize 2500 \
    >runtime/fw.init-config.yaml
  echo 2000 >runtime/server-payloadlen.txt

  run_tb
  pushd runtime >/dev/null; tar cJf ../output/cscaps-$KEY.txz *; popd >/dev/null
done <cscaps.tsv
