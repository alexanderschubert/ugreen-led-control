//go:build linux

package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

// From <linux/i2c-dev.h> and <linux/i2c.h>.
const (
	ioctlSlave      = 0x0703
	ioctlSlaveForce = 0x0706
	ioctlSMBus      = 0x0720

	smbusWrite = 0
	smbusRead  = 1

	smbusByteData     = 2
	smbusI2CBlockData = 8
	smbusBlockMax     = 32

	retries  = 5
	lockFile = "/var/run/ugreen-led-i2c.lock"
)

// struct i2c_smbus_ioctl_data: u8 read_write, u8 command, u32 size, union i2c_smbus_data *data.
type smbusIoctlData struct {
	readWrite uint8
	command   uint8
	size      uint32
	data      *[smbusBlockMax + 2]byte
}

type bus struct {
	path string
	file *os.File
	lock *os.File
}

func ioctl(fd, request, arg uintptr) error {
	if _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, fd, request, arg); errno != 0 {
		return errno
	}
	return nil
}

// findBus returns the I801 SMBus adapter the controller sits on, e.g. /dev/i2c-0.
// The adapter is listed under /sys/bus/i2c even before i2c-dev creates /dev/i2c-N.
func findBus() (string, error) {
	names, _ := filepath.Glob("/sys/bus/i2c/devices/i2c-*/name")

	for _, name := range names {
		content, err := os.ReadFile(name)
		if err != nil || !strings.HasPrefix(string(content), "SMBus I801 adapter") {
			continue
		}

		path := "/dev/" + filepath.Base(filepath.Dir(name))
		if _, err := os.Stat(path); err != nil {
			return "", fmt.Errorf("%s is missing; load the i2c-dev module (modprobe i2c-dev)", path)
		}
		return path, nil
	}

	return "", errors.New("no SMBus I801 adapter found")
}

func openBus(path string, force bool) (*bus, error) {
	if path == "" {
		found, err := findBus()
		if err != nil {
			return nil, err
		}
		path = found
	}

	// One writer at a time: the web UI and the status daemon share the controller.
	lock, err := os.OpenFile(lockFile, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		lock.Close()
		return nil, err
	}

	file, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		lock.Close()
		return nil, err
	}

	request := uintptr(ioctlSlave)
	if force {
		request = ioctlSlaveForce
	}

	if err := ioctl(file.Fd(), request, controllerAddr); err != nil {
		file.Close()
		lock.Close()
		if errors.Is(err, syscall.EBUSY) {
			return nil, fmt.Errorf("address 0x3a on %s is used by a kernel driver (led_ugreen loaded?); unload it or pass --force", path)
		}
		return nil, err
	}

	return &bus{path: path, file: file, lock: lock}, nil
}

func (b *bus) close() {
	b.file.Close()
	b.lock.Close()
}

func (b *bus) smbus(readWrite, command byte, size uint32, data *[smbusBlockMax + 2]byte) error {
	args := smbusIoctlData{readWrite: readWrite, command: command, size: size, data: data}
	err := ioctl(b.file.Fd(), ioctlSMBus, uintptr(unsafe.Pointer(&args)))
	runtime.KeepAlive(data)
	return err
}

func (b *bus) readBlock(command byte, length int) ([]byte, error) {
	var data [smbusBlockMax + 2]byte
	data[0] = byte(length)

	if err := b.smbus(smbusRead, command, smbusI2CBlockData, &data); err != nil {
		return nil, err
	}
	return append([]byte(nil), data[1:1+length]...), nil
}

func (b *bus) writeBlock(command byte, payload []byte) error {
	var data [smbusBlockMax + 2]byte
	data[0] = byte(len(payload))
	copy(data[1:], payload)

	return b.smbus(smbusWrite, command, smbusI2CBlockData, &data)
}

func (b *bus) readByte(command byte) (byte, error) {
	var data [smbusBlockMax + 2]byte

	if err := b.smbus(smbusRead, command, smbusByteData, &data); err != nil {
		return 0, err
	}
	return data[0], nil
}

// change sends one command and waits until the controller confirms it,
// with the same timing and retries as the led-ugreen kernel driver.
func (b *bus) change(id, command byte, params [4]byte) error {
	packet := commandPacket(id, command, params)
	err := errors.New("no attempt made")

	for i := 0; i < retries; i++ {
		if i == 0 {
			time.Sleep(time.Millisecond)
		} else {
			time.Sleep(30 * time.Millisecond)
		}

		if err = b.writeBlock(id, packet); err != nil {
			continue
		}

		time.Sleep(2 * time.Millisecond)

		var ok byte
		if ok, err = b.readByte(regLastCommandOK); err == nil && ok == 1 {
			return nil
		}
		if err == nil {
			err = errors.New("the controller did not confirm the command")
		}
	}

	return err
}

func (b *bus) status(name string) (ledStatus, error) {
	id, err := ledID(name)
	if err != nil {
		return ledStatus{}, err
	}

	for i := 0; i < retries; i++ {
		if i == 0 {
			time.Sleep(time.Millisecond)
		} else {
			time.Sleep(30 * time.Millisecond)
		}

		var block []byte
		if block, err = b.readBlock(regStatusBase+id, statusLength); err != nil {
			continue
		}
		var s ledStatus
		if s, err = parseStatus(name, block); err == nil {
			return s, nil
		}
	}

	return ledStatus{}, fmt.Errorf("%s: %w", name, err)
}
