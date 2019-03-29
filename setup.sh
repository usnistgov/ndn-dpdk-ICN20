#!/bin/bash
cd "$( dirname "${BASH_SOURCE[0]}" )"
source config.sh

sudo NRHUGE=0 $HOME/spdk-*/scripts/setup.sh
sudo umount /mnt/huge

if ! mount | grep /mnt/huge1G; then
  sudo mkdir -p /mnt/huge1G
  sudo mount -t hugetlbfs nodev /mnt/huge1G -o pagesize=1G
  echo Mounting 1GB hugepages at /mnt/huge1G
fi
for NODE in node0 node1; do
  echo $HUGE1G_NPAGES | sudo tee /sys/devices/system/node/$NODE/hugepages/hugepages-1048576kB/nr_hugepages >/dev/null
  echo Reserving $HUGE1G_NPAGES hugepages on $NODE
done

sudo modprobe ib_uverbs

sudo $CMD_MGMTPROXY start
