#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

process_stop $CMD_MSIBENCH
fw_stop
gen_stop
