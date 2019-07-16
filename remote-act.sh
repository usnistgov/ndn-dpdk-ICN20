#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

ACT=$1
case $ACT in
fw_start)
  fw_start
  ;;
fw_stop)
  fw_stop
  ;;
esac
