mkdir -p runtime

function remote_fw_act() {
  ssh -n $SSH_FW bash --login $(pwd)/remote-act.sh "$@"
}

function do_rsync() {
  if [[ $NO_RSYNC -ne 0 ]]; then
    sleep 0.5
  else
    rsync -W $1 $2
  fi
}

function process_stop() {
  local PATTERN=$1
  while pgrep -f "$PATTERN" >/dev/null; do
    sudo pkill -f "$PATTERN"
    sleep 0.5
  done
}

function if_whitelist() {
  local INPUT=$1
  local ID=$2
  if echo $INPUT | grep -F ':' >/dev/null; then # PCI address
    echo '-w '$INPUT
    return
  fi
  echo -n '--vdev net_af_packet'$ID',iface='
  if echo $INPUT | grep -F '.' >/dev/null; then # IPv4 network
    echo $(ip route get $INPUT | awk 'NR==1{print $4}')
  else # ifname
    echo $INPUT
  fi
}

function if_port() {
  local INPUT=$1
  local ID=$2
  if echo $INPUT | grep -F ':' >/dev/null; then # PCI address
    echo $INPUT
  else
    echo 'net_af_packet'$ID
  fi
}

function copy_initconfig() {
  local OUTPUT=runtime/$1.init-config.yaml
  if ! [[ -f $OUTPUT ]]; then
    if [[ -f runtime/init-config.yaml ]]; then
      cp runtime/init-config.yaml $OUTPUT
    else
      cp init-config.yaml $OUTPUT
    fi
  fi
}

function fw_start() {
  copy_initconfig fw

  if [[ $(hostname -s) != $HOST_FW ]]; then
    do_rsync runtime/fw.init-config.yaml $SSH_FW:$(pwd)/runtime/
    remote_fw_act fw_start
    do_rsync $SSH_FW:$(pwd)/runtime/version.txt runtime/
    return
  fi

  sudo MGMT=tcp://127.0.0.1:6345 $CMD_NDNFW \
    -l $CPU_FW --socket-mem $MEM_FW --file-prefix fw \
    $(if_whitelist $IF_FW0 0) $(if_whitelist $IF_FW1 1) $(if_whitelist $IF_FW2 2) \
    -- -initcfg @runtime/fw.init-config.yaml &>runtime/fw.log &

  while ! $CMD_MGMTCMD version &>runtime/version.txt; do
    sleep 0.5
  done

  $CMD_CREATEFACE --scheme ether --port $(if_port $IF_FW0 0) \
                  --local 02:00:00:00:00:02 --remote 01:00:5e:00:17:aa >runtime/faceid-A.txt
  $CMD_CREATEFACE --scheme ether --port $(if_port $IF_FW1 1) \
                  --local 02:01:00:00:00:02 --remote 01:00:5e:00:17:aa >runtime/faceid-B.txt
  $CMD_CREATEFACE --scheme ether --port $(if_port $IF_FW2 2) \
                  --local 02:02:00:00:00:02 --remote 01:00:5e:00:17:aa >runtime/faceid-C.txt
  for FACENAME in A B C; do
    local NEXTHOP=$(cat runtime/faceid-$FACENAME.txt)
    for I in $(seq 0 $((NPATTERNS-1))); do
      local PREFIX=/$FACENAME/$I
      $CMD_MGMTCMD ndt updaten $PREFIX $I >/dev/null
      $CMD_MGMTCMD fib insert $PREFIX $NEXTHOP >/dev/null
    done
  done
}

function fw_stop() {
  if [[ $(hostname -s) != $HOST_FW ]]; then
    remote_fw_act fw_stop
    do_rsync $SSH_FW:$(pwd)/runtime/fw.log runtime/
    return
  fi

  process_stop '\--file-prefix fw '
  rm -f runtime/faceid-?.txt
}

function topo2dirs() {
  local TOPO=$1
  case $TOPO in
  single)
    echo '[AB]'
    ;;
  bidirection)
    echo '[AB,BA]'
    ;;
  circle)
    echo '[AB,BC,CA]'
    ;;
  all)
    echo '[AB,BC,CA,AC,CB,BA]'
    ;;
  esac
}

function gen_start() {
  copy_initconfig gen

  local DIRS=$(topo2dirs $TOPO)

  echo '
faces:
- Scheme: ether
  Port: "'$(if_port $IF_GEN0 0)'"
  Local: "02:00:00:00:00:01"
  Remote: "01:00:5e:00:17:aa"
- Scheme: ether
  Port: "'$(if_port $IF_GEN1 1)'"
  Local: "02:01:00:00:00:01"
  Remote: "01:00:5e:00:17:aa"
- Scheme: ether
  Port: "'$(if_port $IF_GEN2 2)'"
  Local: "02:02:00:00:00:01"
  Remote: "01:00:5e:00:17:aa"
dirs: '$DIRS'
nPatterns: '$NPATTERNS'
interval: '$INTERVAL_INIT'
interestNameLen: '$INTERESTNAMELEN'
dataSuffixLen: '$DATASUFFIXLEN'
payloadLen: '$PAYLOADLEN'
' >runtime/gen.input.yaml
  nodejs build/make-ndnping-config <runtime/gen.input.yaml >runtime/gen.tasks.yaml

  sudo MGMT=tcp://127.0.0.1:6345 $CMD_NDNPING \
    -l $CPU_GEN --socket-mem $MEM_GEN --file-prefix gen \
    $(if_whitelist $IF_GEN0 0) $(if_whitelist $IF_GEN1 1) $(if_whitelist $IF_GEN2 2) \
    -- -initcfg @runtime/gen.init-config.yaml -cnt 1s -tasks=@runtime/gen.tasks.yaml &>runtime/gen.log &

  while ! $CMD_MGMTCMD version &>/dev/null; do
    sleep 0.5
  done
}

function gen_stop() {
  process_stop '\--file-prefix gen '
}

function msibench_exec() {
  DEBUG='*' $CMD_MSIBENCH --IntervalMin $MSI_INTERVALMIN --IntervalMax $MSI_INTERVALMAX --IntervalStep $MSI_INTERVALSTEP --DesiredUncertainty $MSI_UNCERTAINTY 2>runtime/msibench.log >runtime/msibench.out
}

function run_msibench() {
  fw_start
  gen_start
  sleep 10
  msibench_exec
  gen_stop
  fw_stop
}
