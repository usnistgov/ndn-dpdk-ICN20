#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

echo 'Starting forwarder.'
fw_start

echo 'Running warmup traffic.'
server_start
client_start
sleep 60
client_stop
server_stop

> runtime/tb-payloadlens.out
for PAYLOADLEN in $(seq 0 1000 8000); do
  sleep 1
  echo 'Testing payloadlen='$PAYLOADLEN'.'
  echo $PAYLOADLEN > runtime/server-payloadlen.txt
  server_start
  sleep 1
  client_tb
  server_stop
  (
    echo $PAYLOADLEN
    tail -2 runtime/tb.out
    echo
  ) >> runtime/tb-payloadlens.out
  tail -2 runtime/tb.out
done

echo 'Stopping.'
fw_stop
