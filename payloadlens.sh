#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

> runtime/tb-payloadlens.out
for PAYLOADLEN in $(seq 0 1000 8000); do
  sleep 1
  echo 'Testing payloadlen='$PAYLOADLEN
  echo $PAYLOADLEN > runtime/server-payloadlen.txt
  run_tb
  (
    echo $PAYLOADLEN
    tail -2 runtime/tb.out
    echo
  ) >> runtime/tb-payloadlens.out
  tail -2 runtime/tb.out
  echo
done
