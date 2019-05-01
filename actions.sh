mkdir -p runtime

function process_stop() {
  local PATTERN=$1
  while pgrep -f "$PATTERN" >/dev/null; do
    sudo pkill -f "$PATTERN"
    sleep 0.5
  done
}

function fw_start() {
  if ! [[ -f runtime/fw.init-config.yaml ]]; then
    cp init-config.yaml runtime/fw.init-config.yaml
  fi

  sudo $CMD_NDNFW -l $CPU_FW --socket-mem $MEM_FW --file-prefix fw -w $IF_DN -w $IF_UP -- -initcfg @runtime/fw.init-config.yaml &>runtime/fw.log &

  while ! $CMD_MGMTCMD version &>runtime/version.txt; do
    sleep 0.5
  done

  $CMD_CREATEFACE --scheme ether --port $IF_DN --local $LOCAL_DN --remote $REMOTE_DN >runtime/faceid-dn.txt
  $CMD_CREATEFACE --scheme ether --port $IF_UP --local $LOCAL_UP --remote $REMOTE_UP >runtime/faceid-up.txt
  local NEXTHOP=$(cat runtime/faceid-up.txt)

  local I=0
  for PREFIX in $PREFIXES; do
    $CMD_MGMTCMD fib insert $PREFIX $NEXTHOP >/dev/null
    $CMD_MGMTCMD ndt updaten $PREFIX $I >/dev/null
    I=$((I+1))
    if [[ $I -ge $FW_NFWS ]]; then I=0; fi
  done
}

function fw_stop() {
  process_stop '\--file-prefix fw '
  rm -f runtime/faceid-dn.txt runtime/faceid-up.txt
}

function server_start() {
  if ! [[ -f runtime/server.init-config.yaml ]]; then
    cp init-config.yaml runtime/server.init-config.yaml
  fi

  local PAYLOADLEN=1000
  if [[ -f runtime/server-payloadlen.txt ]]; then
    PAYLOADLEN=$(cat runtime/server-payloadlen.txt)
  fi

  echo '
- face:
    scheme: ether
    port: "'$IF_SVR'"
    local: "'$LOCAL_SVR'"
    remote: "'$REMOTE_SVR'"
  server:
    patterns: []
    nack: true
' >runtime/server.tasks.yaml
  for PREFIX in $PREFIXES; do
  $CMD_YAMLEDIT -f runtime/server.tasks.yaml -aj 0.server.patterns '{ prefix: '$PREFIX' , payloadlen: '$PAYLOADLEN' }'
  done

  sudo $CMD_NDNPING -l $CPU_SVR --socket-mem $MEM_SVR --file-prefix server -w $IF_SVR -- -initcfg @runtime/server.init-config.yaml -cnt 0 -tasks=@runtime/server.tasks.yaml &>runtime/server.log &
}

function server_stop() {
  process_stop '\--file-prefix server '
}

function client_prepare() {
  if ! [[ -f runtime/client.init-config.yaml ]]; then
    cp init-config.yaml runtime/client.init-config.yaml
  fi

  echo '
- face:
    scheme: ether
    port: "'$IF_CLI'"
    local: "'$LOCAL_CLI'"
    remote: "'$REMOTE_CLI'"
  client:
    patterns: []
    interval: '$CLI_INTERVAL'
' >runtime/client.tasks.yaml
  for PREFIX in $PREFIXES; do
    $CMD_YAMLEDIT -f runtime/client.tasks.yaml -aj 0.client.patterns '{ prefix: '$PREFIX' }'
  done
}

function client_start() {
  client_prepare

  sudo $CMD_NDNPING -l $CPU_CLI --socket-mem $MEM_CLI --file-prefix client -w $IF_CLI -- -initcfg @runtime/client.init-config.yaml -cnt 1s -tasks=@runtime/client.tasks.yaml &>runtime/client.log &
  while ! grep -E 'samp\)' runtime/client.log >/dev/null; do
    sleep 0.5
  done
}

function client_stop() {
  process_stop '\--file-prefix client '
}

function client_tb() {
  client_prepare

  echo '
intervalmin: 500ns
intervalmax: 2500ns
intervalstep: 1ns

txcount: 24000000
txdurationmin: 15s
txdurationmax: 60s

warmuptime: 5s
cooldowntime: 2s
readcountersfreq: 100ms

satisfythreshold: 0.999
retestthreshold: 0.950
retestcount: 1
' >runtime/tb.yaml

  sudo LOG_ThroughputBenchmark=V $CMD_NDNPING -l $CPU_CLI --socket-mem $MEM_CLI --file-prefix client -w $IF_CLI -- -initcfg @runtime/client.init-config.yaml -cnt 0 -tasks=@runtime/client.tasks.yaml -throughput-benchmark=@runtime/tb.yaml 2>runtime/tb.log >runtime/tb.out
}

function run_tb() {
  server_start
  fw_start
  client_start
  sleep $RUNTB_WARMUP
  client_stop
  sleep 1
  client_tb
  fw_stop
  server_stop
}