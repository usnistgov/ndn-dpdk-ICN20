#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh
mkdir -p output

> output/mtu.txt
while read -r -a ROW; do
  if ! [[ ${ROW[0]} =~ [0-9]+ ]]; then continue; fi
  KEY=$(echo "${ROW[*]}" | tr ' ' '-')
  OUTFILE=output/mtu-$KEY.txz

  if ! [[ -f $OUTFILE ]]; then
    rm -f runtime/*
    cat init-config.yaml \
      | $CMD_YAMLEDIT -n face.ethmtu ${ROW[0]} \
      | $CMD_YAMLEDIT -n mempool.ETHRX.dataroomsize $((ROW[0]+128)) \
      | $CMD_YAMLEDIT -n mempool.DATA.dataroomsize $((ROW[1]+512)) \
      >runtime/init-config.yaml
    echo ${ROW[1]} >runtime/server-payloadlen.txt
    if [[ ${ROW[0]} -lt ${ROW[1]} ]]; then
      echo 5000ns >runtime/tb-intervalmax.txt
    fi

    run_tb
    pushd runtime >/dev/null; tar cJf ../$OUTFILE *; popd >/dev/null
  fi

  echo ${ROW[*]}
  tar xOf $OUTFILE tb.out | tail -2
  echo
done <mtu.tsv >output/mtu.txt
