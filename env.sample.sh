# environment configuration

# SSH hostname
HOST_FW=fwhost
SSH_FW=fwhost

# PCI address of network interfaces
IF_CLI=01:00.0
IF_SVR=02:00.0
IF_DN=03:00.0
IF_UP=04:00.0

# CPU and memory allocation
HUGE1G_NPAGES=192
CPU_CLI=0,1,2,3,4,5
MEM_CLI=2048,0
CPU_SVR=6,7,8,9,10,11
MEM_SVR=2048,0
CPU_FW=0,1,2,3,4,5,6,7,8,9,10,11
MEM_FW=16384,0
