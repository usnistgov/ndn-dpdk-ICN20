# environment configuration

# forwarder control
HOST_FW=fwhost # `hostname -s`
SSH_FW=fwhost # SSH hostname
JSONRPC_FW=fwhost # JSON-RPC hostname
NO_RSYNC=0 # set to 1 to disable rsync and assume NFS

# PCI address or ifname or IPv4 address of network interfaces
IF_GEN0=01:00.0
IF_GEN1=02:00.0
IF_GEN2=03:00.0
IF_FW0=01:00.0
IF_FW1=02:00.0
IF_FW2=03:00.0

# CPU and memory allocation
HUGE1G_NPAGES=192
CPU_GEN=0-11
MEM_GEN=4096,0
CPU_FW=0-11
MEM_FW=16384,0

# CPU isolation, 'B' for benchmark, 'O' for other (empty to disable)
CPUSET_B_GEN=$CPU_GEN
CPUSET_O_GEN=12-23
CPUSET_B_FW=$CPU_FW
CPUSET_O_FW=12-23
