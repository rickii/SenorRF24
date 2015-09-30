#############################################################################
#
# Makefile for master_node gateway on Raspberry Pi
#
# By:  TMRh20
# Date:    2013/09
#
# Description:
# ------------
# use make to build master_node
# Run compiled program with: sudo ./master_node
#


# Detect the Raspberry Pi from cpuinfo
#Count the matches for BCM2708 or BCM2709 in cpuinfo
RPI=$(shell cat /proc/cpuinfo | grep Hardware | grep -c BCM2708)
ifneq "${RPI}" "1"
RPI=$(shell cat /proc/cpuinfo | grep Hardware | grep -c BCM2709)
endif

CCFLAGS=-std=c++0x

ifeq "$(RPI)" "1"
# The recommended compiler flags for the Raspberry Pi
CCFLAGS+=-Ofast -mfpu=vfp -mfloat-abi=hard -mtune=arm1176jzf-s 

endif

# define all programs
PROGRAMS = master_node
SOURCES = ${PROGRAMS:=.cpp}

all: ${PROGRAMS}

${PROGRAMS}: ${SOURCES}
	g++ ${CCFLAGS} -Wall -I../ -lrf24-bcm -lrf24network -lrf24mesh -lrf24gateway -lcurl $@.cpp -o $@

clean:
	rm -rf $(PROGRAMS)