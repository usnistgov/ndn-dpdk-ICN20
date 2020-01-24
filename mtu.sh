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
    ETHRX_DATAROOM=$((ROW[0]+128))
    if [[ $ETHRX_DATAROOM -lt 2200 ]]; then ETHRX_DATAROOM=2200; fi
    cat init-config.yaml \
      | $CMD_YAMLEDIT -n Face.EthMtu ${ROW[0]} \
      | $CMD_YAMLEDIT -n Mempool.ETHRX.DataroomSize $ETHRX_DATAROOM \
      | $CMD_YAMLEDIT -n Mempool.DATA1.DataroomSize $((ROW[1]+1024)) \
      >runtime/init-config.yaml

    PAYLOADLEN=${ROW[1]}
    run_msibench

    pushd runtime >/dev/null; tar cJf ../$OUTFILE *; popd >/dev/null
  fi

  RESULTJSON=$(tar xOf $OUTFILE msibench.out | tail -1)
  echo ${ROW[*]} \
       $(echo $RESULTJSON | nodejs build/json-get mean) \
       $(echo $RESULTJSON | nodejs build/json-get stdev) \
       $(echo $RESULTJSON | nodejs build/json-get count)
done <mtu.tsv >output/mtu.txt
