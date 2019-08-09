#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

export NO_REMOTE_ACT=1

ACT=$1
case $ACT in
gen_start)
  sudo bash cpuset.sh $$ $CPUSET_B_GEN $CPUSET_O_GEN
  gen_start
  ;;
fw_start)
  sudo bash cpuset.sh $$ $CPUSET_B_FW $CPUSET_O_FW
  fw_start
  ;;
fw_stop)
  fw_stop
  sudo bash cpuset.sh 0
  ;;
esac
