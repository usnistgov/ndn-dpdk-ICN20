#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh
source actions.sh

fw_start
server_start
client_tb
server_stop
fw_stop
