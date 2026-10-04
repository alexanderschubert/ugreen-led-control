// ugreen-led-i2c talks to the LED controller of UGREEN NAS devices directly
// over /dev/i2c-N, so no kernel module is needed.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

const usage = `Usage:
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] probe
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] [--plain] get <led[,led...]|all>
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] set <led[,led...]|all> <command>

LEDs:     power, netdev, disk1 ... disk8
Commands: color <R> <G> <B> | brightness <0-255> | on | off
          blink <on_ms> <off_ms> | breath <on_ms> <off_ms>

--bus     the SMBus device (default: the "SMBus I801 adapter")
--force   use the address even while a kernel driver (led_ugreen) holds it
--plain   get prints one line per LED for shell scripts:
          <name> <mode> <brightness> <R> <G> <B> <on_ms> <off_ms>
`

func main() {
	os.Exit(run(os.Args[1:]))
}

func fail(err error) int {
	fmt.Fprintln(os.Stderr, "ERROR:", err)
	return 1
}

func printJSON(value any) {
	out, _ := json.MarshalIndent(value, "", "  ")
	fmt.Println(string(out))
}

func run(args []string) int {
	flags := flag.NewFlagSet("ugreen-led-i2c", flag.ContinueOnError)
	flags.Usage = func() { fmt.Fprint(os.Stderr, usage) }
	busPath := flags.String("bus", "", "")
	force := flags.Bool("force", false, "")
	plain := flags.Bool("plain", false, "")

	if err := flags.Parse(args); err != nil {
		return 2
	}
	args = flags.Args()

	if len(args) == 0 || (args[0] != "probe" && len(args) < 2) {
		fmt.Fprint(os.Stderr, usage)
		return 2
	}

	var leds []string
	var command byte
	var params [4]byte

	// Validate everything before touching the bus.
	switch args[0] {
	case "probe":
		leds = ledNames
	case "get", "set":
		var err error
		if leds, err = parseLeds(args[1]); err != nil {
			return fail(err)
		}
		if args[0] == "set" {
			if command, params, err = buildCommand(args[2:]); err != nil {
				return fail(err)
			}
		}
	default:
		fmt.Fprint(os.Stderr, usage)
		return 2
	}

	b, err := openBus(*busPath, *force)
	if err != nil {
		return fail(err)
	}
	defer b.close()

	switch args[0] {
	case "probe":
		var found []string
		for _, name := range leds {
			if _, err := b.status(name); err == nil {
				found = append(found, name)
			}
		}
		printJSON(map[string]any{"bus": b.path, "address": "0x3a", "leds": found})
		if len(found) == 0 {
			return fail(fmt.Errorf("no LED answered on %s", b.path))
		}

	case "get":
		statuses := map[string]ledStatus{}
		for _, name := range leds {
			s, err := b.status(name)
			if err != nil {
				// "all" lists what exists; a named LED that doesn't answer is an error.
				if args[1] == "all" {
					continue
				}
				return fail(err)
			}
			statuses[name] = s
		}
		if *plain {
			for _, name := range leds {
				if s, ok := statuses[name]; ok {
					fmt.Println(plainLine(s))
				}
			}
		} else if len(leds) == 1 {
			printJSON(statuses[leds[0]])
		} else {
			printJSON(statuses)
		}

	case "set":
		for _, name := range leds {
			id, _ := ledID(name)
			if err := b.change(id, command, params); err != nil {
				return fail(fmt.Errorf("%s: %w", name, err))
			}
		}
	}

	return 0
}
