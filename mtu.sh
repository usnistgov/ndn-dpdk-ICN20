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
      | $CMD_YAMLEDIT -n mempool.DATA1.dataroomsize $((ROW[1]+1024)) \
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
