#!/bin/bash
PROC=$1
CPU_B=$2
CPU_O=$3

if [[ $(whoami) != 'root' ]]; then
  exit 1
fi

if [[ $PROC -eq 0 ]]; then # disable
  if [[ -f /dev/cpuset/B/tasks ]]; then
    while [[ $(wc -l </dev/cpuset/B/tasks) -ne 0 ]]; do
      kill $(cat /dev/cpuset/B/tasks)
      sleep 1
    done
    rmdir /dev/cpuset/B
    cat /dev/cpuset/cpuset.cpus >/dev/cpuset/O/cpuset.cpus
    exit 0
  fi
  exit 1
fi

if [[ -z $CPU_O ]]; then
  exit 0
fi

if ! [[ -f /dev/cpuset/tasks ]]; then
  mkdir -p /dev/cpuset
  mount -t cpuset cpuset /dev/cpuset
fi

mkdir -p /dev/cpuset/O
echo $CPU_O >/dev/cpuset/O/cpuset.cpus
echo 1 >/dev/cpuset/O/cpuset.cpu_exclusive
cat /dev/cpuset/cpuset.mems >/dev/cpuset/O/cpuset.mems
for P in $(cat /dev/cpuset/tasks); do
  if readlink /proc/$P/exe >/dev/null; then
    echo $P >/dev/cpuset/O/tasks
  fi
done

mkdir -p /dev/cpuset/B
echo $CPU_B >/dev/cpuset/B/cpuset.cpus
echo 1 >/dev/cpuset/B/cpuset.cpu_exclusive
cat /dev/cpuset/cpuset.mems >/dev/cpuset/B/cpuset.mems
echo $PROC >/dev/cpuset/B/tasks
