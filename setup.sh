#!/bin/bash
HUGE1G_NPAGES=$1
SPDK_PATH=$2

NRHUGE=0 ${SPDK_PATH}/scripts/setup.sh
umount /mnt/huge

if ! mount | grep /mnt/huge1G; then
  mkdir -p /mnt/huge1G
  mount -t hugetlbfs nodev /mnt/huge1G -o pagesize=1G
fi
for NODEDIR in /sys/devices/system/node/node*; do
  echo $HUGE1G_NPAGES > $NODEDIR/hugepages/hugepages-1048576kB/nr_hugepages
done

modprobe ib_uverbs
