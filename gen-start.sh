sudo bash $CPUSETBIN $$ $CPUSET_B $CPUSET_O
sudo MGMT=tcp://0.0.0.0:6345 ndnping-dpdk $EALPARAMS \
  -- -initcfg @$INITCONFIG -cnt 0 -tasks @$GENTASKS &>$GENLOG &

while ! ndndpdk-mgmtcmd version &>/dev/null; do
  sleep 0.5
done
