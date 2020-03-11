sudo bash $CPUSETBIN $$ $CPUSET_B $CPUSET_O
sudo MGMT=tcp://0.0.0.0:6345 ndnfw-dpdk $EALPARAMS \
  -- -initcfg @$INITCONFIG &>$FWLOG &

while ! ndndpdk-mgmtcmd version &>/dev/null; do
  sleep 0.5
done
